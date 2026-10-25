import { describe, expect, it } from "vitest";
import { resolveCreatorVerification } from "./creator-verification";

describe("verificação do criador", () => {
  it("desligada não mostra verificação, mesmo com estilo escolhido", () => {
    expect(resolveCreatorVerification({ verified: false, verified_style: "blue" })).toBeNull();
    expect(resolveCreatorVerification({ verified: false, verified_style: "green" })).toBeNull();
    expect(resolveCreatorVerification({})).toBeNull();
  });
  it("preserva o verde dos criadores antigos", () => {
    expect(resolveCreatorVerification({ verified: true })).toBe("green");
  });
  it("ativada com verde mantém o modelo atual", () => {
    expect(resolveCreatorVerification({ verified: true, verified_style: "green" })).toBe("green");
  });
  it("ativada com azul seleciona o selo azul", () => {
    expect(resolveCreatorVerification({ verified: true, verified_style: "blue" })).toBe("blue");
  });
});