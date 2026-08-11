import * as React from "react";
import {renderToStaticMarkup} from "react-dom/server";

globalThis.React = React;
const campaignModule = await import("../components/campaign-timeline-editor.tsx");
const CampaignTimelineEditor = campaignModule.CampaignTimelineEditor ?? campaignModule.default?.CampaignTimelineEditor;

let input = "";
for await (const chunk of process.stdin) input += chunk;
const campaign = JSON.parse(input);
process.stdout.write(renderToStaticMarkup(React.createElement(CampaignTimelineEditor, {initialCampaign: campaign})));
