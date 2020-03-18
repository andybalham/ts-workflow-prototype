import uuid = require("uuid");
import { FlowStep, FlowStepType } from "./FlowDefinition";
import { FlowHandlers } from "./FlowHandlers";
import { IFlowInstanceRepository, FlowInstance } from "./FlowInstanceRepository";

export class ResumePoint {
    constructor(public instanceId: string, public stepName: string, public state: any) {
    }
}

export class FlowContext {

    // TODO 14Mar20: Add tracing to the FlowContext
    // TODO 08Mar20: This could contain: logging methods, mocks and 'headers'
    // TODO 08Mar20: We wouldn't want mocks to be serialized

    // Dependencies
    readonly instanceRespository: IFlowInstanceRepository;
    readonly handlers: FlowHandlers;

    readonly rootInstanceId: string;
    readonly instanceId: string;
    readonly flowName: string;
    readonly state: any;
    stepName: string;

    private readonly _contextStack: FlowContext[];

    private readonly _isResumeArray: boolean[] = [false];
    readonly resumePoints: ResumePoint[];
    asyncResponse: any;
    resumeStepName: string;

    get isResume(): boolean {
        return this._isResumeArray[0];
    }

    set isResume(value: boolean) {
        this._isResumeArray[0] = value;
    }

    private constructor(
        instanceId: string, handlers?: FlowHandlers, instanceRespository?: IFlowInstanceRepository,
        parentContext?: FlowContext, flowName?: string, state?: any,
        resumePoints?: ResumePoint[], asyncResponse?: any) {

        if (parentContext === undefined) {

            this.handlers = handlers;
            this.instanceRespository = instanceRespository;

            this.rootInstanceId = instanceId;

            this._contextStack = [];

            this.resumePoints = resumePoints;
            this.asyncResponse = asyncResponse;
            this.isResume = (asyncResponse !== undefined);
        }
        else {

            // TODO 14Mar20: Allow for a set of 'flow headers' that are passed down the chain of contexts

            this.handlers = parentContext.handlers;
            this.instanceRespository = parentContext.instanceRespository;

            this.rootInstanceId = parentContext.rootInstanceId;

            this._contextStack = parentContext._contextStack.slice(); // Make element-by-element copy
            this._contextStack.push(parentContext);

            this.resumePoints = parentContext.resumePoints;
            this.asyncResponse = parentContext.asyncResponse;
            this._isResumeArray = parentContext._isResumeArray;
        }

        this.instanceId = instanceId;
        this.flowName = flowName;
        this.state = state;
    }

    static newContext(instanceRespository?: IFlowInstanceRepository): FlowContext {

        const context = new FlowContext(FlowContext.newId(), new FlowHandlers(), instanceRespository);
        return context;
    }

    static newChildContext(parentContext: FlowContext, flowName: string, state: any): FlowContext {

        // TODO 15Mar20: If we are resuming, then we would want to remember the id from the first time

        if (parentContext.isResume) {

            const resumePoint = parentContext.resumePoints.pop();

            const childContext =
                new FlowContext(resumePoint.instanceId, undefined, undefined, parentContext, flowName, resumePoint.state);

            childContext.resumeStepName = resumePoint.stepName;

            return childContext;
        }
        else {

            const childContext =
                new FlowContext(FlowContext.newId(), undefined, undefined, parentContext, flowName, state);

            return childContext;
        }
    }

    static newResumeContext(instanceId: string, asyncResponse: any, instanceRespository: IFlowInstanceRepository): FlowContext {

        const flowInstance = instanceRespository.load(instanceId);

        if (flowInstance === undefined) {
            throw new Error(`No flow instance found with the id: ${instanceId}`);
        }

        const context =
            new FlowContext(
                instanceId, new FlowHandlers(), instanceRespository,
                undefined, undefined, undefined,
                flowInstance.resumePoints, asyncResponse);

        return context
    }

    saveInstance() {
        if (this._contextStack.length > 0) {

            const resumePoints: ResumePoint[] = [new ResumePoint(this.instanceId, this.stepName, this.state)];

            while (this._contextStack.length > 1) {
                const context = this._contextStack.pop();
                resumePoints.push(new ResumePoint(context.instanceId, context.stepName, context.state));
            }

            const flowInstance = new FlowInstance(this.rootInstanceId, resumePoints);

            this.instanceRespository.save(flowInstance);

            this._contextStack.splice(0, this._contextStack.length); // Clear the stack so it doesn't get saved again
        }
    }

    loadInstance(instanceId: string) {
        return this.instanceRespository.load(instanceId);
    }

    private static newId(): string {
        return uuid.v1();
    }
}