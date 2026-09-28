// wordrun.js：按处理预算处理并留账（只依赖原生 API）
// state: { names, uses, ledger, applied }
//   names   已定义名字（升序）；uses 使用顺序清单（可重复）
//   ledger  本批没处理完、压着等收尾的事件 [kind, name]（eid 记事件 id）
//   applied 已处理事件的 id，重放时据此跳过
import { shapeOk, isReserved } from "./word.js";

function fail(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}

function startState(spec) {
  const given = (spec && spec.state) || {};
  const names = Array.isArray(given.names) ? given.names.slice() : [];
  const uses = Array.isArray(given.uses) ? given.uses.slice() : [];
  const ledger = Array.isArray(given.ledger)
    ? given.ledger.map(function (row) {
        const copy = [row[0], row[1]];
        Object.defineProperty(copy, "eid", { value: row.eid, enumerable: false });
        return copy;
      })
    : [];
  const applied = Array.isArray(given.applied) ? given.applied.slice() : [];
  return { names: names, uses: uses, ledger: ledger, applied: applied };
}

function codeFor(spec, key, fallback) {
  return (spec && spec[key]) || fallback;
}

function readEvent(spec, event) {
  if (event === null || typeof event !== "object" || Array.isArray(event)) {
    throw fail(codeFor(spec, "event_error_code", "E_BAD_EVENT"));
  }
  if (event.kind !== "def" && event.kind !== "use") {
    throw fail(codeFor(spec, "event_error_code", "E_BAD_EVENT"));
  }
  if (typeof event.name !== "string") {
    throw fail(codeFor(spec, "event_error_code", "E_BAD_EVENT"));
  }
  return { kind: event.kind, name: event.name, id: event.id };
}

// 校验并落地一条事件；不合法直接抛错。
function judge(spec, state, kind, name, id) {
  if (!shapeOk(name)) {
    throw fail(codeFor(spec, "bad_name_code", "E_BAD_NAME"));
  }
  if (isReserved(spec.words, name)) {
    throw fail(codeFor(spec, "reserved_code", "E_RESERVED"));
  }
  if (kind === "def") {
    if (state.names.indexOf(name) !== -1) {
      throw fail(codeFor(spec, "dup_code", "E_DUP_NAME"));
    }
    state.names.push(name);
    state.names.sort();
  } else {
    if (state.names.indexOf(name) === -1) {
      throw fail(codeFor(spec, "no_name_code", "E_NO_NAME"));
    }
    state.uses.push(name);
  }
  if (id !== undefined && state.applied.indexOf(id) === -1) {
    state.applied.push(id);
  }
}

export function step(spec) {
  const state = startState(spec);
  const events = Array.isArray(spec.events) ? spec.events : [];
  let budget = Number.isFinite(spec.budget) ? Math.max(0, Math.trunc(spec.budget)) : 0;

  const carried = state.ledger.length;
  const queued = state.ledger.splice(0, state.ledger.length);
  let served = 0;
  let judged = 0;

  // 先还旧账：账上的事件已经过结构初检，按先进先出处理。
  for (const row of queued) {
    if (row.eid !== undefined && state.applied.indexOf(row.eid) !== -1) {
      judged += 1;
      continue;
    }
    if (budget <= 0) {
      state.ledger.push(row);
      judged += 1;
      continue;
    }
    judge(spec, state, row[0], row[1], row.eid);
    budget -= 1;
    served += 1;
    judged += 1;
  }

  // 再处理新事件：每条花一次共用处理预算，用尽就连着载压账。
  for (const event of events) {
    const item = readEvent(spec, event);
    if (item.id !== undefined && state.applied.indexOf(item.id) !== -1) {
      judged += 1;
      continue;
    }
    if (budget <= 0) {
      const row = [item.kind, item.name];
      Object.defineProperty(row, "eid", { value: item.id, enumerable: false });
      state.ledger.push(row);
      judged += 1;
      continue;
    }
    judge(spec, state, item.kind, item.name, item.id);
    budget -= 1;
    served += 1;
    judged += 1;
  }

  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) {
      const copy = [row[0], row[1]];
      Object.defineProperty(copy, "eid", { value: row.eid, enumerable: false });
      return copy;
    }),
    judged: judged,
    judged_bound: carried + events.length
  };
}

// 收尾：把账上没处理完的事件全部做完，不受预算限制，返回补齐条数。
export function close(spec) {
  const state = startState(spec);
  let catchup = 0;
  while (state.ledger.length > 0) {
    const row = state.ledger.shift();
    if (row.eid !== undefined && state.applied.indexOf(row.eid) !== -1) {
      continue;
    }
    judge(spec, state, row[0], row[1], row.eid);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
