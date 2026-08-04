DO $stage10$
DECLARE canonical "ArtistProfile"%ROWTYPE;
BEGIN
  IF EXISTS (SELECT 1 FROM "ArtistProfile" WHERE ("slug"='vvviruz' OR lower("displayName")='vvviruz') AND "id"<>'artist-profile-vvviruz') THEN
    RAISE EXCEPTION 'Ambiguous vvviruz artist identity; manual review required';
  END IF;
  SELECT * INTO canonical FROM "ArtistProfile" WHERE "id"='artist-profile-vvviruz';
  IF FOUND THEN
    IF canonical."slug"<>'vvviruz' OR canonical."displayName"<>'vvviruz' OR canonical."workflowStatus"<>'DRAFT' OR canonical."publishedAt" IS NOT NULL OR canonical."publishedVersionId" IS NOT NULL THEN
      RAISE EXCEPTION 'Existing canonical artist is not the required private unpublished DRAFT';
    END IF;
    RETURN;
  END IF;
  INSERT INTO "ArtistProfile" ("id","slug","displayName","workflowStatus","draftUpdatedAt","createdAt","updatedAt")
  VALUES ('artist-profile-vvviruz','vvviruz','vvviruz','DRAFT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
END $stage10$;
