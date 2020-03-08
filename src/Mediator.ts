import { ActivityRequest, ActivityRequestHandler } from "./FlowRequest";
import { FlowContext } from "./FlowContext";

// TODO 08Mar20: Rename to RequestDispatcher?

export class Mediator {
    
    private handlerMap = new Map<string, any>();

    public registerHandler<T extends ActivityRequestHandler<TReq, TRes>, TReq extends ActivityRequest<TRes>, TRes>(handler: T) {

        this.handlerMap[handler.key] = handler;

        return this;
    }

    public sendRequest<TReq extends ActivityRequest<TRes>, TRes>(flowContext: FlowContext, request: TReq) : TRes {

        const requestHandlerKey = request.handlerKey;

        const handler = this.handlerMap[requestHandlerKey];
     
        if (handler === undefined) {
            throw `No handler found for: ${requestHandlerKey}`;
        }

        const response = handler.handle(flowContext, request);
        
        return response;
    }
}
