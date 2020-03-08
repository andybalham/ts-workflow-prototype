import uuid = require("uuid");
import { FlowStep, FlowStepType } from "./FlowDefinition";

export class FlowContext {

    // TODO 08Mar20: This could contain: logging methods, mocks and 'headers'
    // TODO 08Mar20: We wouldn't want mocks to be serialized

    readonly flowInstanceId: string;

    flowName: string;
    stepName: string;
    stepTrace: string;

    constructor() {
        this.flowInstanceId = uuid.v1();
    }

    addStep(step: FlowStep) {

        this.stepName = step.name;

        if (step.name !== undefined) {
            this.addStepToTrace(step);
        }
    }

    private addStepToTrace(step: FlowStep) {
        this.stepTrace =
            (this.stepTrace === undefined ? '' : this.stepTrace + ' >> ') + this.getStepTraceText(step);
    }

    private getStepTraceText(step: FlowStep): string {
        switch (step.type) {

            case FlowStepType.Activity:
                return step.name;

            case FlowStepType.Decision:
                return '?' + step.name + '?';

            case FlowStepType.Label:
                return '#' + step.name + '#';

            default:
                throw new Error(`Unhandled step type: ${step.type}`);
        }
    }
}