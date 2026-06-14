function getError(rawError) {
  const error = rawError;
  if (!error || typeof error !== "object") {
    return null;
  }
  return {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...(error.cause ? { cause: getError(error.cause) } : {}),
  };
}

function newPromise() {
  const newPromise = {
    promise: Promise.resolve(),
    resolve: (value) => {},
    reject: (reason) => {},
  };
  const promise = new Promise((resolve, reject) => {
    newPromise.resolve = resolve;
    newPromise.reject = reject;
  });
  newPromise.promise = promise;
  return newPromise;
}

export class EvalScope {
  input = newPromise();
  output = newPromise();

  constructor() {
    this.run();
  }

  async run() {
    do {
      const expression = await this.input.promise;
      this.input = newPromise();
      try {
        const result = await (0, eval)(expression);
        this.output.resolve(result);
      } catch (error) {
        this.output.reject(error);
      }
      this.output = newPromise();
    } while (true);
  }

  async eval(script) {
    this.input.resolve(script);
    return this.output.promise;
  }
}

const evalScope = new EvalScope();
window.addEventListener("message", async function (event) {
  try {
    const result = await evalScope.eval(event.data);
    event.source.postMessage(
      {
        type: "eval-result",
        result,
      },
      event.origin
    );
  } catch (error) {
    event.source.postMessage(
      {
        type: "eval-error",
        error: getError(error),
      },
      event.origin
    );
  }
});
