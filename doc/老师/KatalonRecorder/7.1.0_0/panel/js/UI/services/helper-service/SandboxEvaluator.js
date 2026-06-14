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

export class SandboxEvaluator {
  outputPromise = newPromise();

  constructor(sandboxPath = "sandbox.html") {
    this.sandboxPath = sandboxPath;
    this.eval = this.eval.bind(this);
  }

  init() {
    this.sandbox = document.createElement("iframe");
    this.sandbox.src = this.sandboxPath;
    this.sandbox.style.display = "none";
    document.body.appendChild(this.sandbox);

    window.addEventListener("message", (event) => {
      if (event.data?.type === "eval-result") {
        this.outputPromise.resolve(event.data.result);
        this.outputPromise = newPromise();
      }
      if (event.data?.type === "eval-error") {
        this.outputPromise.reject(event.data.error);
        this.outputPromise = newPromise();
      }
    });
  }

  async eval(script) {
    this.sandbox.contentWindow.postMessage(script, "*");
    return this.outputPromise.promise;
  }
}

export const sandboxEvaluator = new SandboxEvaluator();
globalThis.sandboxEvaluator = sandboxEvaluator;

sandboxEvaluator.init();
