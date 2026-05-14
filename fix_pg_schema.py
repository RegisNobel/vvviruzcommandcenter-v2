path = "prisma/schema.postgres.prisma"

with open(path, "rb") as f:
    data = f.read()

old = b"  unsubscribedAt   DateTime?\r\n  sendLogs         EmailSendLog[]\r\n\r\n  @@index([status, createdAt])\r\n  @@index([source, status])\r\n}"

new_block = (
    b"  unsubscribedAt   DateTime?\r\n"
    b"  // Source attribution (V1 - first-source preserved on upsert)\r\n"
    b'  sourceUtmSource     String      @default("")\r\n'
    b'  sourceUtmMedium     String      @default("")\r\n'
    b'  sourceUtmCampaign   String      @default("")\r\n'
    b'  sourceUtmContent    String      @default("")\r\n'
    b'  sourceUtmTerm       String      @default("")\r\n'
    b'  sourceReferrer      String      @default("")\r\n'
    b'  sourceLandingPage   String      @default("")\r\n'
    b'  sourceOfferMode     String      @default("")\r\n'
    b'  sourceOfferName     String      @default("")\r\n'
    b'  sourceSignupContext String      @default("")\r\n'
    b"  sendLogs         EmailSendLog[]\r\n"
    b"\r\n"
    b"  @@index([status, createdAt])\r\n"
    b"  @@index([source, status])\r\n"
    b"  @@index([sourceUtmCampaign])\r\n"
    b"  @@index([sourceOfferMode])\r\n"
    b"}"
)

if old in data:
    data = data.replace(old, new_block, 1)
    with open(path, "wb") as f:
        f.write(data)
    print("OK - replaced")
else:
    print("NOT FOUND")
