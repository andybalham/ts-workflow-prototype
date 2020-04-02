import { FlowRequestHandler } from "../src/FlowRequestHandler";
import { FlowBuilder } from "../src/FlowBuilder";
import { FlowDefinition } from "../src/FlowDefinition";
import { FlowHandlers, IActivityRequestHandler } from "../src/FlowHandlers";
import { FlowContext, FlowInstanceStackFrame } from "../src/FlowContext";
import { expect } from "chai";
import { IFlowInstanceRepository } from "../src/FlowInstanceRepository";
import uuid = require("uuid");

class SumActivityRequest {
    values: number[];
}

class SumActivityResponse {
    total: number;
}

class SyncSumActivityHandler implements IActivityRequestHandler<SumActivityRequest, SumActivityResponse> {
    public handle(_flowContext: FlowContext, request: SumActivityRequest): SumActivityResponse {
        const total = request.values.reduce((a, b) => a + b, 0);
        return { total: total };
    }
}

class AsyncActivityHandler implements IActivityRequestHandler<any, any> {
    requestJson: string;
    public handle(flowContext: FlowContext, request: any): any {
        flowContext.asyncRequestId = uuid.v4();
        this.requestJson = JSON.stringify(request);
        return undefined;
    }
}

class ChildFlowRequest {
    value1: number; value2: number;
}
class ChildFlowResponse {
    total: number;
}
class ChildFlowState {
    total: number;
    value1: number; value2: number;
}

class InMemoryFlowInstanceRepository implements IFlowInstanceRepository {

    private readonly _flowInstances: Map<string, string> = new Map<string, string>();

    save(instanceId: string, stackFrames: FlowInstanceStackFrame[]) {
        this._flowInstances[instanceId] = JSON.stringify(stackFrames);
    }

    load(instanceId: string): FlowInstanceStackFrame[] {
        return JSON.parse(this._flowInstances[instanceId]);
    }
}

class ChildFlowHandler extends FlowRequestHandler<ChildFlowRequest, ChildFlowResponse, ChildFlowState> {

    flowName = ChildFlowHandler.name;

    constructor() {
        super(ChildFlowResponse, ChildFlowState);
    }

    buildFlow(flowBuilder: FlowBuilder<ChildFlowRequest, ChildFlowResponse, ChildFlowState>): FlowDefinition<ChildFlowRequest, ChildFlowResponse, ChildFlowState> {
        return flowBuilder
            .initialise((req, state) => {
                state.value1 = req.value1; state.value2 = req.value2;
            })
            .perform("Sum value 1 and 2", SumActivityRequest, SumActivityResponse,
                (req, state) => { req.values = [state.value1, state.value2]; },
                (res, state) => { state.total = res.total; })
            .finalise(ChildFlowResponse, (res, state) => {
                res.total = state.total;
            });
    }
}

class ParentFlowRequest {
    a: number; b: number; c: number; d: number;
}
class ParentFlowResponse {
    total: number;
}
class ParentFlowState {
    a: number; b: number; c: number; d: number;
    total: number;
}

class ParentFlowHandler extends FlowRequestHandler<ParentFlowRequest, ParentFlowResponse, ParentFlowState> {

    flowName = ParentFlowHandler.name;

    constructor() {
        super(ParentFlowResponse, ParentFlowState);
    }

    protected debugPreActivityRequest(_stepName: string, _request: any, _state: any) { }
    protected debugPostActivityResponse(_stepName: string, _response: any, _state: any) { }

    buildFlow(flowBuilder: FlowBuilder<ParentFlowRequest, ParentFlowResponse, ParentFlowState>): FlowDefinition<ParentFlowRequest, ParentFlowResponse, ParentFlowState> {
        return flowBuilder
            .initialise((req, state) => {
                state.a = req.a; state.b = req.b; state.c = req.c; state.d = req.d;
            })
            .perform("Add a and b", ChildFlowRequest, ChildFlowResponse,
                (req, state) => { req.value1 = state.a; req.value2 = state.b; },
                (res, state) => { state.total = res.total; })
            .perform("Add c and total", ChildFlowRequest, ChildFlowResponse,
                (req, state) => { req.value1 = state.c; req.value2 = state.total; },
                (res, state) => { state.total = res.total; })
            .perform("Add d and total", ChildFlowRequest, ChildFlowResponse,
                (req, state) => { req.value1 = state.d; req.value2 = state.total; },
                (res, state) => { state.total = res.total; })
            .finalise(ParentFlowResponse, (res, state) => {
                res.total = state.total;
            });
    }
}

describe('Handlers', () => {

    it('returns the total of the inputs when activity invoked synchronously', () => {

        const flowContext = new FlowContext();
        flowContext.handlers
            .register(SumActivityRequest, SumActivityResponse, new SyncSumActivityHandler())
            .register(ChildFlowRequest, ChildFlowResponse, new ChildFlowHandler());

        const request = new ParentFlowRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;
        request.d = 50;

        const response = new ParentFlowHandler().handle(flowContext, request);

        expect(flowContext.instanceId).to.be.not.undefined;
        expect(response?.total).to.be.equal(666);
    });

    it('returns the total of the inputs when activity invoked asynchronously', () => {

        const flowInstanceRepository = new InMemoryFlowInstanceRepository();
        const asyncActivityHandler = new AsyncActivityHandler();

        let flowContext = new FlowContext(flowInstanceRepository);
        addAsyncHandlers(flowContext, asyncActivityHandler);

        const request = new ParentFlowRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;
        request.d = 50;

        const response01 = new ParentFlowHandler().handle(flowContext, request);

        expect(flowContext.instanceId).to.not.be.undefined;
        expect(flowContext.asyncRequestId).to.not.be.undefined;
        expect(response01).to.be.undefined;

        const firstInstanceId = flowContext.instanceId;

        // Send back asynchronous response 01

        const asyncRequestJson01 = asyncActivityHandler.requestJson;

        const asyncResponse01 =
            new SyncSumActivityHandler().handle(new FlowContext(), JSON.parse(asyncRequestJson01));

        let stackFrames = flowInstanceRepository.load(flowContext.instanceId);
        expect(stackFrames).to.not.be.undefined;

        flowContext = new FlowContext(flowInstanceRepository, flowContext.instanceId, stackFrames, asyncResponse01);
        addAsyncHandlers(flowContext, asyncActivityHandler);

        const response02 = new ParentFlowHandler().handle(flowContext);

        expect(flowContext.instanceId).to.not.be.undefined;
        expect(flowContext.instanceId).equal(firstInstanceId);
        expect(flowContext.asyncRequestId).to.not.be.undefined;
        expect(response02).to.be.undefined;

        // Send back asynchronous response 02

        const asyncRequestJson02 = asyncActivityHandler.requestJson;

        const asyncResponse02 =
            new SyncSumActivityHandler().handle(new FlowContext(), JSON.parse(asyncRequestJson02));

        stackFrames = flowInstanceRepository.load(flowContext.instanceId);
        expect(stackFrames).to.not.be.undefined;

        flowContext = new FlowContext(flowInstanceRepository, flowContext.instanceId, stackFrames, asyncResponse02);
        addAsyncHandlers(flowContext, asyncActivityHandler);

        const response03 = new ParentFlowHandler().handle(flowContext);

        expect(flowContext.instanceId).to.not.be.undefined;
        expect(flowContext.instanceId).equal(firstInstanceId);
        expect(flowContext.asyncRequestId).to.not.be.undefined;
        expect(response03).to.be.undefined;

        // Send back asynchronous response 03

        const asyncRequestJson03 = asyncActivityHandler.requestJson;

        const asyncResponse03 =
            new SyncSumActivityHandler().handle(new FlowContext(), JSON.parse(asyncRequestJson03));

        stackFrames = flowInstanceRepository.load(flowContext.instanceId);
        expect(stackFrames).to.not.be.undefined;

        flowContext = new FlowContext(flowInstanceRepository, flowContext.instanceId, stackFrames, asyncResponse03);
        addAsyncHandlers(flowContext, asyncActivityHandler);

        const response04 = new ParentFlowHandler().handle(flowContext);

        expect(flowContext.instanceId).to.be.not.undefined;
        expect(flowContext.instanceId).equal(firstInstanceId);
        expect(flowContext.asyncRequestId).to.be.undefined;
        expect(response04.total).to.be.equal(666);

        stackFrames = flowInstanceRepository.load(flowContext.instanceId);
        expect(stackFrames).to.be.undefined;
    });
});

function addAsyncHandlers(flowContext: FlowContext, asyncActivityHandler: AsyncActivityHandler) {
    flowContext.handlers
        .register(SumActivityRequest, SumActivityResponse, asyncActivityHandler)
        .register(ChildFlowRequest, ChildFlowResponse, new ChildFlowHandler());
}
