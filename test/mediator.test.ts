import { expect } from "chai";
import { ActivityRequest, ActivityRequestHandler } from "../src/FlowRequest";
import { Mediator } from "../src/Mediator";
import { FlowContext } from "../src/FlowContext";

class ExampleActivityRequest extends ActivityRequest<ExampleActivityResponse> {
    constructor() { super(ExampleActivityRequest, ExampleActivityResponse); }
    input: number;
}

class ExampleActivityResponse {
    output: number;
}

class ExampleHandler extends ActivityRequestHandler<ExampleActivityRequest, ExampleActivityResponse> {
    constructor() {
        super(ExampleActivityRequest);
    }
    public handle(_flowContext: FlowContext, request: ExampleActivityRequest): ExampleActivityResponse {
        return { output: request.input };
    }
}

describe('Mediator', () => {

    it('Mediator can send request to handler', () => {

        const mediator = new Mediator();

        mediator.registerHandler(new ExampleHandler());

        const request = new ExampleActivityRequest();
        request.input = 616;

        const response = mediator.sendRequest(new FlowContext(), request) as ExampleActivityResponse;

        expect(response).to.be.not.null;
        expect(response.output).to.be.equal(request.input);
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