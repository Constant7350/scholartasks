import { describe, expect, it } from "vitest";
import { checkContact } from "../src";

const good = { name: " Pat  Lee ", email: "pat@example.com", topic: "Parent or family", message: "How much does it cost?" };

describe("contact form", () => {
  it("accepts and cleans a normal message", () => {
    const r = checkContact(good);
    expect(r).toEqual({ ok: true, msg: { name: "Pat Lee", email: "pat@example.com", topic: "Parent or family", message: "How much does it cost?" } });
  });
  it("keeps the school name when given", () => {
    const r = checkContact({ ...good, topic: "School or counselor", school: "North High" });
    expect(r.ok && r.msg.school).toBe("North High");
  });
  it("falls back to 'Something else' for an unknown topic", () => {
    const r = checkContact({ ...good, topic: "hack" });
    expect(r.ok && r.msg.topic).toBe("Something else");
  });
  it("needs a name, a real email and a message", () => {
    expect(checkContact({ ...good, name: "" }).ok).toBe(false);
    expect(checkContact({ ...good, email: "pat@" }).ok).toBe(false);
    expect(checkContact({ ...good, message: "hi" }).ok).toBe(false);
    expect(checkContact(null).ok).toBe(false);
  });
  it("flags the hidden trap field as spam", () => {
    expect(checkContact({ ...good, website: "http://x.co" })).toMatchObject({ ok: false, spam: true });
  });
  it("turns away link-stuffed messages", () => {
    expect(checkContact({ ...good, message: "http://a http://b http://c http://d" }).ok).toBe(false);
  });
});
