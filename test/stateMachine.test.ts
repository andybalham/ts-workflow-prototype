import { FlowRequestHandler } from "../src/FlowRequestHandler";
import { FlowBuilder } from "../src/FlowBuilder";
import { FlowDefinition, EndFlowStep } from "../src/FlowDefinition";
import { FlowContext } from "../src/FlowContext";
import { expect } from "chai";
import { IActivityRequestHandler, FlowHandlers } from "../src/FlowHandlers";

describe('Handlers', () => {
    it('can be mocked', () => {

        const flowContext = new FlowContext();

        flowContext.handlers = new FlowHandlers()
            .register(DipValidateProductAndFeeRequest, DipValidateProductAndFeeResponse, new DipValidateProductAndFeeHandler())
            .register(DipValidateMortgageClubRequest, DipValidateMortgageClubResponse, new DipValidateMortgageClubHandler())
            .register(UpdateCaseStatusRequest, EmptyResponse, new UpdateCaseStatusHandler())
            .register(SendCaseStatusUpdatedEventRequest, EmptyResponse, new SendCaseStatusUpdatedEventHandler())
            .register(DipCreateCaseRequest, EmptyResponse, new DipCreateCaseHandler())
            .register(EmptyRequest, EmptyResponse, new EmptyHandler())
            ;

        const request = new DipCreationRequest();

        const response = new DipCreationHandler().handle(flowContext, request);

        expect(response?.result).to.equal(DipCreationResult.DipCreated);
    });
});

class DipCreationRequest {
    caseId: string;
    lender: string;
    options: any;
    timestamp: Date;
}

class DipCreationResponse {
    result: DipCreationResult;
}

enum DipCreationResult {
    DipCreated = "CaseCreated",
    FailedValidation = "FailedValidation",
    Error = "Error",
}

class DipCreationState {
    caseId: string;
    lender: string;
    options: any;
    timestamp: Date;
    productAndFeeValidationResult: ProductAndFeeValidationResult;
    mortgageClubValidationResult: MortgageClubValidationResult;
    validationStatus: DipValidationStatus;
    overallResult: DipCreationResult;
}

enum DipValidationStatus {
    ProductFeeValidationFailed = "ProductFeeValidationFailed",
    ProductValidationFailed = "ProductValidationFailed",
    MortgageClubValidationFailed = "MortgageClubValidationFailed",
}

class DipValidateProductAndFeeRequest {
    caseId: string;
    lender: string;
    options: any;
    timestamp: Date;
}

class DipValidateProductAndFeeResponse {
    validationResult: ProductAndFeeValidationResult;
}

class DipValidateProductAndFeeHandler implements IActivityRequestHandler<DipValidateProductAndFeeRequest, DipValidateProductAndFeeResponse> {
    handle(flowContext: FlowContext, request: DipValidateProductAndFeeRequest): DipValidateProductAndFeeResponse {
        const response = new DipValidateProductAndFeeResponse();
        response.validationResult = ProductAndFeeValidationResult.Success;
        return response;
    }
}

enum ProductAndFeeValidationResult {
    Success = "Success",
    InvalidProduct = "InvalidProduct",
    InvalidFee = "InvalidFee",
    Error = "Error",
}

class DipValidateMortgageClubRequest {
    caseId: string;
    lender: string;
    options: any;
    timestamp: Date;
}

class DipValidateMortgageClubResponse {
    validationResult: MortgageClubValidationResult;
}

class DipValidateMortgageClubHandler implements IActivityRequestHandler<DipValidateMortgageClubRequest, DipValidateMortgageClubResponse> {
    handle(flowContext: FlowContext, request: DipValidateMortgageClubRequest): DipValidateMortgageClubResponse {
        const response = new DipValidateMortgageClubResponse();
        response.validationResult = MortgageClubValidationResult.Success;
        return response;
    }
}

enum MortgageClubValidationResult {
    Success = "Success",
    InvalidMortgageClub = "InvalidMortgageClub",
    Error = "Error",
}

class UpdateCaseStatusRequest {
    caseId: string;
    caseStatus: string;
}

class UpdateCaseStatusHandler implements IActivityRequestHandler<UpdateCaseStatusRequest, EmptyResponse> {
    handle(flowContext: FlowContext, request: UpdateCaseStatusRequest): EmptyResponse {
        return {};
    }
}

class UpdateValidationStatusRequest {
    caseId: string;
    validationStatus: DipValidationStatus;
}

class SendCaseStatusUpdatedEventRequest {
    caseId: string;
    caseStatus: DipCaseStatus | DipValidationStatus;
    updateAt: Date;
    lender: string;
}

class SendCaseStatusUpdatedEventHandler implements IActivityRequestHandler<SendCaseStatusUpdatedEventRequest, EmptyResponse> {
    handle(flowContext: FlowContext, request: SendCaseStatusUpdatedEventRequest): EmptyResponse {
        return {};
    }
}

enum DipCaseStatus {
    DipDecisionInProgress = "DipDecisionInProgress",
}

class DipCreateCaseRequest {
    caseId: string;
    lender: string;
    options: any;
    timestamp: Date;
}

class DipCreateCaseHandler implements IActivityRequestHandler<DipCreateCaseRequest, EmptyResponse> {
    handle(flowContext: FlowContext, request: DipCreateCaseRequest): EmptyResponse {
        return {};
    }
}

// TODO 04Apr20: These could be part of the library

class EmptyRequest { }

class EmptyResponse { }

class EmptyHandler implements IActivityRequestHandler<EmptyRequest, EmptyResponse> {
    handle(flowContext: FlowContext, request: EmptyRequest): EmptyResponse {
        return {};
    }
}

class DipCreationHandler extends FlowRequestHandler<DipCreationRequest, DipCreationResponse, DipCreationState> {

    flowName = DipCreationHandler.name;

    constructor() {
        super(DipCreationResponse, DipCreationState);
    }

    buildFlow(flowBuilder: FlowBuilder<DipCreationRequest, DipCreationResponse, DipCreationState>):
        FlowDefinition<DipCreationRequest, DipCreationResponse, DipCreationState> {

        return flowBuilder
            .initialise((req, state) => {
                state.caseId = req.caseId;
                state.lender = req.lender;
                state.options = req.options;
                state.timestamp = req.timestamp;
            })

            // Validate Product And Fees

            .perform("Validate Product And Fees", DipValidateProductAndFeeRequest, DipValidateProductAndFeeResponse,
                (req, state) => {
                    req.caseId = state.caseId;
                    req.lender = state.lender;
                    req.options = state.options;
                    req.timestamp = state.timestamp;
                },
                (res, state) => {
                    state.productAndFeeValidationResult = res.validationResult;
                })

            .evaluate("Product And Fee Validation Result", state => state.productAndFeeValidationResult, cases => cases
                .when(v => v === ProductAndFeeValidationResult.Success).goto("Validate Mortgage Club")
                .when(v => v === ProductAndFeeValidationResult.InvalidProduct).goto("Invalid Product Selection")
                .when(v => v === ProductAndFeeValidationResult.InvalidFee).goto("Invalid Fee Selection")
                .when(v => v === ProductAndFeeValidationResult.Error).goto("Unknown Failure State")
            ).else().error(v => `Unexpected product and fee validation result: ${v}`)

            .perform("Invalid Product Selection", EmptyRequest, EmptyResponse, (_req, _state) => { },
                (_res, state) => { state.validationStatus = DipValidationStatus.ProductValidationFailed })
            .goto("HandledFailureState")

            .perform("Invalid Fee Selection", EmptyRequest, EmptyResponse, (_req, _state) => { },
                (_res, state) => { state.validationStatus = DipValidationStatus.ProductFeeValidationFailed })
            .goto("HandledFailureState")

            // Validate Mortgage Club

            .perform("Validate Mortgage Club", DipValidateMortgageClubRequest, DipValidateMortgageClubResponse,
                (req, state) => {
                    req.caseId = state.caseId;
                    req.lender = state.lender;
                    req.options = state.options;
                    req.timestamp = state.timestamp;
                },
                (res, state) => {
                    state.mortgageClubValidationResult = res.validationResult;
                })

            .evaluate("Mortgage Club Validation Result", state => state.mortgageClubValidationResult, cases => cases
                .when(v => v === MortgageClubValidationResult.Success).goto("Validation Success")
                .when(v => v === MortgageClubValidationResult.InvalidMortgageClub).goto("Invalid Mortgage Club")
                .when(v => v === MortgageClubValidationResult.Error).goto("Unknown Failure State")
            ).else().error(v => `Unexpected mortgage club validation result: ${v}`)

            .perform("Invalid Mortgage Club", EmptyRequest, EmptyResponse, (_req, _state) => { },
                (_res, state) => { state.validationStatus = DipValidationStatus.MortgageClubValidationFailed })
            .goto("HandledFailureState")

            // Validation Success

            .label("Validation Success")

            .perform("Update Case Status (DipDecisionInProgress)", UpdateCaseStatusRequest, EmptyResponse,
                (req, state) => {
                    req.caseId = state.caseId;
                    req.caseStatus = "DipDecisionInProgress";
                })

            .perform("Send Case Status Updated Event (DipDecisionInProgress)", SendCaseStatusUpdatedEventRequest, EmptyResponse,
                (req, state) => {
                    req.caseId = state.caseId;
                    req.caseStatus = DipCaseStatus.DipDecisionInProgress;
                    req.lender = state.lender;
                    req.updateAt = state.timestamp;
                })

            .perform("Create Case", DipCreateCaseRequest, EmptyResponse,
                (req, state) => {
                    req.caseId = state.caseId;
                    req.lender = state.lender;
                    req.options = state.options;
                    req.timestamp = state.timestamp;
                })

            .perform("Set overall result - Dip Created", EmptyRequest, EmptyResponse, (_req, _state) => { },
                (_res, state) => { state.overallResult = DipCreationResult.DipCreated })

            .end()

            // Handled Failures

            .label("HandledFailureState")

            .perform("Update Case Status for Known Failure", UpdateValidationStatusRequest, EmptyResponse,
                (req, state) => {
                    req.caseId = state.caseId;
                    req.validationStatus = state.validationStatus;
                })

            .perform("Send Case Status Updated Event (ValidationFailure)", SendCaseStatusUpdatedEventRequest, EmptyResponse,
                (req, state) => {
                    req.caseId = state.caseId;
                    req.caseStatus = state.validationStatus;
                    req.lender = state.lender;
                    req.updateAt = state.timestamp;
                })

            .perform("Set overall result - Failed Validation", EmptyRequest, EmptyResponse, (_req, _state) => { },
                (_res, state) => { state.overallResult = DipCreationResult.FailedValidation })

            .end()

            // Unknown failures

            .label("Unknown Failure State")

            .perform("Set overall result - Error", EmptyRequest, EmptyResponse, (_req, _state) => { },
                (_res, state) => { state.overallResult = DipCreationResult.Error })

            .end()

            .finalise(DipCreationResponse, (res, state) => {
                res.result = state.overallResult;
            });
    }
}