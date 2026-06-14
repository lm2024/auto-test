class AsyncCommand { //Implement ICommand
  constructor(action, ...params) {
    this.timeStamp = Date.now();
    this.action = action;
    this.params = params;
  }
  async execute() {
    await this.action(...this.params);
  }
}

export { AsyncCommand };