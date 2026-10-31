import { describe, expect, it } from "vitest";

import { sortReviewsPinnedFirst, type Review } from "./product-types";

const r = (name: string, pinned?: boolean): Review => ({ name, rating: 5, date: "", text: "x", ...(pinned ? { pinned } : {}) });

describe("sortReviewsPinnedFirst", () => {
  it("coloca fixadas no topo mantendo a ordem do painel entre elas", () => {
    const list = [r("a"), r("b", true), r("c"), r("d", true), r("e")];
    expect(sortReviewsPinnedFirst(list).map((x) => x.name)).toEqual(["b", "d", "a", "c", "e"]);
  });

  it("mantém a ordem original quando nenhuma está fixada", () => {
    const list = [r("a"), r("b"), r("c")];
    expect(sortReviewsPinnedFirst(list).map((x) => x.name)).toEqual(["a", "b", "c"]);
  });

  it("mantém a ordem quando todas estão fixadas", () => {
    const list = [r("a", true), r("b", true)];
    expect(sortReviewsPinnedFirst(list).map((x) => x.name)).toEqual(["a", "b"]);
  });

  it("desafixar devolve a avaliação ao bloco comum sem mudar a ordem dos demais", () => {
    const list = [r("a", true), r("b"), r("c", true)];
    const sorted = sortReviewsPinnedFirst(list);
    expect(sorted.map((x) => x.name)).toEqual(["a", "c", "b"]);
    sorted[0]!.pinned = false;
    expect(sortReviewsPinnedFirst(sorted).map((x) => x.name)).toEqual(["c", "a", "b"]);
  });

  it("não altera o array original", () => {
    const list = [r("a"), r("b", true)];
    sortReviewsPinnedFirst(list);
    expect(list.map((x) => x.name)).toEqual(["a", "b"]);
  });
});
