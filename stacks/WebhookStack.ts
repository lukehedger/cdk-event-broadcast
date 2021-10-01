import { Api, App, Stack, StackProps } from "@serverless-stack/resources";

export default class WebhookStack extends Stack {
  public readonly WebhookEndpoint: string;

  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const webhookAPI = new Api(this, "WebhookAPI", {
      routes: { "GET /": "src/eventConsumer.handler" },
    });

    this.WebhookEndpoint = webhookAPI.url;
  }
}
