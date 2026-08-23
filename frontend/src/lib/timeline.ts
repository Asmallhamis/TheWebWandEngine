import {
  EvalResponse,
  EvalTimeline,
  EvalTimelineCard,
  EvalTimelineDecoderState,
  EvalTimelineEvent,
  EvalTimelineProcessItem,
  EvalTimelineStorage,
} from '../types';

const EMPTY_PILES: EvalTimelineEvent['piles'] = { deck: [], hand: [], discarded: [] };
const COMPACT_EVENT_LENGTHS: Record<number, number> = {
  0: 1, 1: 3, 2: 2, 3: 6, 4: 2, 5: 2, 6: 2, 7: 2, 8: 1,
  9: 2, 10: 3, 11: 2, 12: 1, 13: 1, 14: 1, 15: 2, 16: 8, 17: 1, 99: 6,
};

type CompactTimelineEvent = Array<string | number | boolean | null | number[][] | Record<string, unknown>>;
type CardLookup = Map<number, EvalTimelineCard>;

export interface EvalTimelinePage {
  pageIndex: number;
  events: EvalTimelineEvent[];
  initialProcess: EvalTimelineProcessItem[];
}

const optionalNumber = (value: unknown) => typeof value === 'number' ? value : undefined;
const clonePiles = (piles?: EvalTimelineEvent['piles']): EvalTimelineEvent['piles'] => ({
  deck: [...(piles?.deck || [])],
  hand: [...(piles?.hand || [])],
  discarded: [...(piles?.discarded || [])],
});

export function createTimelineDecoderState(): EvalTimelineDecoderState {
  return {
    cast: 1,
    timelineExecutionSeq: 0,
    shots: [],
    actions: [],
    process: [],
    piles: clonePiles(EMPTY_PILES),
  };
}

export function cloneTimelineDecoderState(state: EvalTimelineDecoderState): EvalTimelineDecoderState {
  return {
    cast: state.cast,
    timelineExecutionSeq: state.timelineExecutionSeq,
    shots: [...state.shots],
    actions: state.actions.map(action => ({ ...action })),
    process: state.process.map(item => ({ ...item })),
    piles: clonePiles(state.piles),
  };
}

function compactPiles(token: CompactTimelineEvent, code: number): EvalTimelineEvent['piles'] | null {
  const value = token[COMPACT_EVENT_LENGTHS[code]];
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Array.isArray)) return null;
  return {
    deck: [...(value[0] as number[])],
    hand: [...(value[1] as number[])],
    discarded: [...(value[2] as number[])],
  };
}

function actionId(value: unknown, cards: CardLookup): { id: string; uid?: number } {
  if (typeof value === 'number') return { id: cards.get(value)?.id || `#${value}`, uid: value };
  return { id: typeof value === 'string' ? value : '?' };
}

function updateProcessForActionStart(
  state: EvalTimelineDecoderState,
  context: EvalTimelineDecoderState['actions'][number],
) {
  const parent = state.process[state.process.length - 1];
  if (parent && /^DIVIDE_\d+$/.test(parent.id)) parent.copyStep = (parent.copyStep ?? 0) + 1;
  if (parent && context.drawTotal !== undefined) {
    parent.drawStep = context.drawStep ?? 0;
    parent.drawTotal = context.drawTotal;
  }
  state.process.push({
    id: context.id,
    uid: context.uid,
    slot: context.slot,
    drawStep: parent ? undefined : context.drawStep,
    drawTotal: parent ? undefined : context.drawTotal,
  });
}

export function advanceCompactTimelineState(
  compactEvents: CompactTimelineEvent[],
  cards: CardLookup,
  state: EvalTimelineDecoderState,
  firstEvent: number,
  emitEvents: boolean,
): { events: EvalTimelineEvent[]; firstTimelineId?: number; lastTimelineId?: number } {
  const events: EvalTimelineEvent[] = [];
  let firstTimelineId: number | undefined;
  let lastTimelineId: number | undefined;

  compactEvents.forEach((token, offset) => {
    const code = Number(token[0]);
    const nextPiles = compactPiles(token, code);
    if (nextPiles) state.piles = nextPiles;

    let type = '';
    let info: EvalTimelineEvent['info'] = {};
    let afterEvent: (() => void) | undefined;

    switch (code) {
      case 0: type = 'initial_deck'; break;
      case 1:
        type = 'cast_start';
        state.cast = optionalNumber(token[2]) ?? state.cast;
        info = { mana: optionalNumber(token[1]) };
        break;
      case 2: type = 'cast_ready'; info = { mana: optionalNumber(token[1]) }; break;
      case 3:
        type = 'cast_end';
        info = {
          cast_delay: optionalNumber(token[1]),
          recharge_time: optionalNumber(token[2]),
          delay: optionalNumber(token[3]),
          mana_delta: optionalNumber(token[4]),
          recoil: optionalNumber(token[5]),
        };
        break;
      case 4: type = 'shot_created'; info = { id: optionalNumber(token[1]) }; break;
      case 5: {
        type = 'shot_start';
        const shot = optionalNumber(token[1]);
        if (shot !== undefined) state.shots.push(shot);
        info = { id: shot };
        break;
      }
      case 6: {
        type = 'shot_end';
        info = { id: optionalNumber(token[1]) };
        afterEvent = () => { state.shots.pop(); };
        break;
      }
      case 7: type = 'deck_ordered'; info = { shuffled: token[1] === 1 }; break;
      case 8: type = 'draw_start'; break;
      case 9: type = 'draw_end'; info = { ok: token[1] === null ? undefined : token[1] === 1 }; break;
      case 10: {
        type = 'draw_many_start';
        const howMany = optionalNumber(token[1]);
        info = { how_many: howMany, instant_reload_if_empty: token[2] === 1 };
        const parent = state.process[state.process.length - 1];
        if (parent && howMany !== undefined) {
          parent.drawStep = 0;
          parent.drawTotal = howMany;
        }
        break;
      }
      case 11: type = 'draw_many_end'; info = { how_many: optionalNumber(token[1]) }; break;
      case 12: type = 'discarded_to_deck'; break;
      case 13: type = 'hand_to_discarded'; break;
      case 14: type = 'reload_start'; break;
      case 15: type = 'reload_end'; info = { reload_time: optionalNumber(token[1]) }; break;
      case 16: {
        type = 'action_start';
        const card = actionId(token[1], cards);
        state.timelineExecutionSeq += 1;
        const context: EvalTimelineDecoderState['actions'][number] = {
          id: card.id,
          timelineId: state.timelineExecutionSeq,
          uid: card.uid,
          source: token[2] === 1 ? 'draw' : 'action',
          slot: optionalNumber(token[3]),
          iteration: optionalNumber(token[4]),
          recursion: optionalNumber(token[5]),
          drawStep: optionalNumber(token[6]),
          drawTotal: optionalNumber(token[7]),
        };
        state.actions.push(context);
        updateProcessForActionStart(state, context);
        firstTimelineId ??= context.timelineId;
        lastTimelineId = context.timelineId;
        info = {
          id: context.id,
          timeline_id: context.timelineId,
          uid: context.uid,
          source: context.source,
          slot: context.slot,
          iteration: context.iteration,
          recursion: context.recursion,
          draw_step: context.drawStep,
          draw_total: context.drawTotal,
        };
        break;
      }
      case 17: {
        type = 'action_end';
        const context = state.actions[state.actions.length - 1];
        info = context ? {
          id: context.id,
          timeline_id: context.timelineId,
          uid: context.uid,
          source: context.source,
          slot: context.slot,
          iteration: context.iteration,
          recursion: context.recursion,
        } : {};
        afterEvent = () => {
          state.actions.pop();
          state.process.pop();
        };
        break;
      }
      case 99: {
        type = String(token[1] || 'unknown');
        const rawInfo = token[5];
        info = rawInfo && typeof rawInfo === 'object' && !Array.isArray(rawInfo)
          ? rawInfo as EvalTimelineEvent['info']
          : {};
        if (emitEvents) {
          events.push({
            i: firstEvent + offset,
            type,
            cast: optionalNumber(token[2]),
            shot: optionalNumber(token[3]),
            action: typeof token[4] === 'string' ? token[4] : undefined,
            info,
            piles: state.piles,
          });
        }
        return;
      }
      default: throw new Error(`Unknown compact timeline event code: ${code}`);
    }

    if (emitEvents) {
      events.push({
        i: firstEvent + offset,
        type,
        cast: state.cast,
        shot: state.shots[state.shots.length - 1],
        action: state.actions[state.actions.length - 1]?.id,
        info,
        piles: state.piles,
      });
    }
    afterEvent?.();
  });

  return { events, firstTimelineId, lastTimelineId };
}

export async function loadTimelinePage(timeline: EvalTimeline, pageIndex: number): Promise<EvalTimelinePage> {
  const storage = timeline.storage;
  if (!storage || storage.kind !== 'opfs-compact-v1') {
    if (pageIndex !== 0) throw new Error('Timeline page is not available');
    return { pageIndex: 0, events: timeline.events || [], initialProcess: [] };
  }
  const chunk = storage.chunks[pageIndex];
  if (!chunk) throw new Error(`Timeline page ${pageIndex + 1} does not exist`);

  const root = await (navigator.storage as any).getDirectory();
  const directory = await root.getDirectoryHandle(storage.directory);
  const handle = await directory.getFileHandle(storage.file);
  const file = await handle.getFile();
  const payload = await file.slice(chunk.offset, chunk.offset + chunk.length).text();
  const compactEvents = JSON.parse(payload) as CompactTimelineEvent[];
  const cards = new Map(timeline.cards.map(card => [card.uid, card]));
  const state = cloneTimelineDecoderState(chunk.checkpoint);
  const initialProcess = state.process.map(item => ({ ...item }));
  const decoded = advanceCompactTimelineState(compactEvents, cards, state, chunk.first_event, true);
  return { pageIndex, events: decoded.events, initialProcess };
}

export async function deleteTimelineStorage(storage?: EvalTimelineStorage): Promise<void> {
  if (!storage || storage.kind !== 'opfs-compact-v1' || !(navigator.storage as any)?.getDirectory) return;
  try {
    const root = await (navigator.storage as any).getDirectory();
    const directory = await root.getDirectoryHandle(storage.directory);
    await directory.removeEntry(storage.file);
  } catch (error: any) {
    if (error?.name !== 'NotFoundError') console.warn('[Timeline] Failed to remove stored timeline:', error);
  }
}

export function rehydrateTimelinePiles(data: EvalResponse | null | undefined): void {
  const events = data?.timeline?.events;
  if (!Array.isArray(events)) return;
  let last: EvalTimelineEvent['piles'] = EMPTY_PILES;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (!event) continue;
    if (event.piles) last = event.piles;
    else event.piles = last;
  }
}
