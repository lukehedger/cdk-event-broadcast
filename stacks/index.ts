import { App } from "@serverless-stack/resources";
import EventBroadcastStack from "./EventBroadcastStack";
import WebhookStack from "./WebhookStack";

export default function main(app: App): void {
  app.setDefaultFunctionProps({
    runtime: "nodejs14.x",
  });

  const webhookStack = new WebhookStack(app, "webhook-stack");

  new EventBroadcastStack(app, "event-broadcast-stack", {
    WebhookEndpoint: webhookStack.WebhookEndpoint,
  });
}
