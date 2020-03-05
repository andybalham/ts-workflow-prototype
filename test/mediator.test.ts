import { expect } from "chai";
import { ActivityRequest, ActivityRequestHandler } from "../src/FlowRequest";
import { FlowRequestHandler } from "../src/FlowRequestHandler";
import { Mediator } from "../src/Mediator";
import { FlowDefinition } from "../src/FlowDefinition";

class ExampleActivityRequest extends ActivityRequest<ExampleActivityResponse> {
    constructor() { super(ExampleActivityRequest, ExampleActivityResponse); }
    input: number;
}

class ExampleActivityResponse {
    output: number;
}

class ExampleHandler extends ActivityRequestHandler<ExampleActivityRequest, ExampleActivityResponse> {
    public handle(request: ExampleActivityRequest): ExampleActivityResponse {
        return { output: request.input };
    }
}

class ExampleFlowRequest extends ActivityRequest<ExampleActivityResponse> {
    constructor() { super(ExampleActivityRequest, ExampleActivityResponse); }
    input: number;
}

class ExampleFlowResponse {
    output: number;
}

class ExampleFlowState {
    value: number;
}

// class ExampleFlowHandler extends FlowRequestHandler<ExampleFlowRequest, ExampleFlowResponse, ExampleFlowState> {

    // build(flowBuilder: FlowBuilder<ExampleFlowState>): void {
    //     flowBuilder
    //         .start(ExampleFlowRequest,
    //             (request, state) => { state.value = request.input; })
            
    //         .perform("MyActivity", ExampleActivityRequest, ExampleActivityResponse,
    //             (request, state) => { request.input = state.value; },
    //             (response, state) => { state.value = response.output; })
            
    //         .switchOn("Input number", state => state.value,
    //             when => when
    //                 .equal(653).goto("Somewhere")
    //                 .true(value => value > 200).continue())
    //         .else().continue()

    //         .end(ExampleFlowResponse,
    //             (response, state) => { response.output = state.value; })
    //         ;
    // }
// }

describe('Mediator', () => {

    it('Mediator can send request to handler', () => {

        const mediator = new Mediator();

        // TODO: How do we register these handlers?
        mediator.registerHandler(new ExampleHandler(ExampleActivityRequest));

        const request = new ExampleActivityRequest();
        request.input = 616;

        const response = mediator.send(request) as ExampleActivityResponse;

        expect(response).to.be.not.null;
        expect(response.output).to.be.equal(request.input);
    });

    it.only('Mediator can send request to flow handler', () => {

        const mediator = new Mediator();

        // mediator.registerHandler(new ExampleFlowHandler(ExampleFlowRequest, ExampleFlowResponse, ExampleFlowState));

        const request = new ExampleFlowRequest();
        request.input = 616;

        const response = mediator.send(request) as ExampleFlowResponse;

        expect(response).to.be.not.null;
    });

    it('Flow can be built', () => {

        // const flowBuilder = new FlowBuilder<ExampleFlowState>();

        // flowBuilder
        //     .start(ExampleFlowRequest,
        //         (req, state) => { state.value = req.input; })

        //     .perform("MyActivity", ExampleActivityRequest, ExampleActivityResponse,
        //         (req, state) => { req.input = state.value; },
        //         (res, state) => { state.value = res.output; })

        //     .switchOn("Input number", state => state.value,
        //         when => when
        //             .equal(653).goto("Summat")
        //             .true(value => value > 200).continue())
        //     .else().continue()

        //     .end(ExampleFlowResponse,
        //         (res, state) => { res.output = state.value; })
        //     ;
    });
});