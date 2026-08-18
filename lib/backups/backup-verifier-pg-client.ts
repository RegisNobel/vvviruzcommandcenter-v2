import pg, {type ClientConfig, type CustomTypesConfig} from "pg";

const {Client, types: defaultTypes} = pg;
const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/;

export function parsePostgresTimestampWithoutTimeZoneAsUtc(value: string) {
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) throw new TypeError("PostgreSQL timestamp without time zone is outside the verifier contract.");

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = ""] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(fraction.padEnd(3, "0"));
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  parsed.setUTCHours(hour, minute, second, millisecond);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute ||
    parsed.getUTCSeconds() !== second ||
    parsed.getUTCMilliseconds() !== millisecond
  ) {
    throw new TypeError("PostgreSQL timestamp without time zone is invalid.");
  }

  return parsed;
}

export const backupVerifierPgTypes: CustomTypesConfig = {
  getTypeParser(oid, format) {
    if (oid === defaultTypes.builtins.TIMESTAMP && (format === undefined || format === "text")) {
      return parsePostgresTimestampWithoutTimeZoneAsUtc;
    }
    return defaultTypes.getTypeParser(oid, format);
  }
};

export function createBackupVerifierPgClient(config: Omit<ClientConfig, "types">) {
  return new Client({...config, types: backupVerifierPgTypes});
}

const backupVerifierPgClient = {
  backupVerifierPgTypes,
  createBackupVerifierPgClient,
  parsePostgresTimestampWithoutTimeZoneAsUtc
};

export default backupVerifierPgClient;
