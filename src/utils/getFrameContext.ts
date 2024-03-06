import type { Context, FrameContext } from '../types/context.js'
import type { Env } from '../types/env.js'
import { getIntentState } from './getIntentState.js'
import { parsePath } from './parsePath.js'

type GetFrameContextParameters<
  env extends Env = Env,
  path extends string = string,
  //
  _state = env['State'],
> = {
  context: Context<env, path>
  cycle: FrameContext['cycle']
  initialState?: _state
  state?: _state
}

type GetFrameContextReturnType<
  env extends Env = Env,
  path extends string = string,
  //
  _state = env['State'],
> = {
  context: FrameContext<env, path>
  getState: () => _state
}

export function getFrameContext<
  env extends Env,
  path extends string,
  //
  _state = env['State'],
>(
  parameters: GetFrameContextParameters<env, path, _state>,
): GetFrameContextReturnType<env, path, _state> {
  const { context, cycle, state } = parameters
  const { frameData, initialPath, previousButtonValues, req, verified } =
    context || {}

  const { buttonValue, inputText, redirect, reset } = getIntentState({
    buttonValues: previousButtonValues || [],
    frameData,
  })

  const status = (() => {
    if (redirect) return 'redirect'
    if (reset) return 'initial'
    return context.status || 'initial'
  })()

  // If the user has clicked a reset button, we want to set the URL back to the
  // initial URL.
  const url =
    (reset ? `${new URL(req.url).origin}${initialPath}` : undefined) ||
    parsePath(context.url)

  let previousState = (() => {
    if (context.status === 'initial') return parameters.initialState
    return context?.previousState || parameters.initialState
  })()

  function deriveState(
    derive?: (state: _state) => void | Promise<void>,
  ): _state | Promise<_state> {
    if (status !== 'response') return previousState as _state
    if (!derive) return previousState as _state
    if (cycle === 'image') return state as _state

    const clone = structuredClone(previousState)
    if ((derive as any)[Symbol.toStringTag] === 'AsyncFunction')
      return (derive(clone as _state) as any).then(() => {
        previousState = clone
        return previousState
      })

    derive(clone as _state)
    previousState = clone
    return previousState as _state
  }

  return {
    context: {
      buttonIndex: frameData?.buttonIndex,
      buttonValue,
      cycle,
      deriveState: deriveState as FrameContext['deriveState'],
      frameData,
      initialPath,
      inputText,
      previousButtonValues,
      previousState: previousState as any,
      req,
      res: (data) => ({ data, format: 'frame' }),
      status,
      transactionId: frameData?.transactionId,
      url,
      var: context.var,
      verified,
    },
    getState: () => previousState as _state,
  }
}
