import {validateDeploymentEnvironment} from "../lib/server/deployment-env";

const result = validateDeploymentEnvironment(process.env);
console.log(JSON.stringify({
  ok: result.ok,
  missing: result.missing,
  invalid: result.invalid,
  resolved: result.resolved
}, null, 2));
if (!result.ok) process.exitCode = 1;
