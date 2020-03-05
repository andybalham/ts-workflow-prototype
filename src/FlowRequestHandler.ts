import { FlowDefinition } from "./FlowDefinition";
import { ActivityRequest, ActivityRequestHandler } from "./FlowRequest";
import { Mediator } from "./Mediator";

export abstract class FlowRequestHandler<TReq extends ActivityRequest<TRes>, TRes, TState> extends ActivityRequestHandler<TReq, TRes> {

    private ResponseType: new () => TRes;
    private StateType: new () => TState;
    private flowDefinition: FlowDefinition<TReq, TRes, TState>;
    private mediator: Mediator;

    constructor(RequestType: new () => TReq, ResponseType: new () => TRes, StateType: new () => TState, mediator: Mediator) {
        
        super(RequestType);

        this.ResponseType = ResponseType;
        this.StateType = StateType;

        this.flowDefinition = new FlowDefinition<TReq, TRes, TState>();
        this.build(this.flowDefinition);

        this.mediator = mediator;
    }

    abstract build(flowBuilder: FlowDefinition<TReq, TRes, TState>): void;

    handle(request: TReq): TRes {

        const state = new this.StateType();
        this.flowDefinition.initialiseState(request, state);

        for (let stepIndex = 0; stepIndex < this.flowDefinition.steps.length; stepIndex++) {
            
            const step = this.flowDefinition.steps[stepIndex];
            
            const stepRequest = new step.RequestType();
            step.bindRequest(stepRequest, state);

            const stepResponse = this.mediator.send(stepRequest);

            step.bindState(stepResponse, state);
        }

        const response = new this.ResponseType();
        this.flowDefinition.bindResponse(response, state);

        return response;
    }
}
