import { Interface } from "./base-interface.js";

const IWizardDialogMediatorInterface = new Interface("IWizardDialogMediatorInterface",
    ["setWizardDialogScreens", "invokeNext", "invokeBack", "invokeCancel"]);

export { IWizardDialogMediatorInterface }
