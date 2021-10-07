import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";

const eventbridge = new EventBridgeClient({ region: process.env.AWS_REGION });

export const handler: APIGatewayProxyHandlerV2 = async (
  event: APIGatewayProxyEventV2
) => {
  const putEventsCommand = new PutEventsCommand({
    Entries: [
      {
        Detail: JSON.stringify({
          broadcastMessage: "Hello, from eventProducer",
        }),
        DetailType: "BROADCAST",
        EventBusName: process.env.EVENT_BUS_NAME,
        Source: "event.broadcast",
      },
    ],
  });

  await eventbridge.send(putEventsCommand);

  console.log("Put EventBridge event");

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/plain" },
    body: `Hello, World! Your request was received at ${event.requestContext.time}.`,
  };
};
