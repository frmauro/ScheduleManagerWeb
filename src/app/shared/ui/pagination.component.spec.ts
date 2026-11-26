import { TestBed } from '@angular/core/testing';
import type { PageMeta } from '../../core/models/api-models';
import { PaginationComponent } from './pagination.component';

function setup(meta: PageMeta) {
  const fixture = TestBed.createComponent(PaginationComponent);
  fixture.componentRef.setInput('meta', meta);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const [prev, next] = Array.from(el.querySelectorAll('button'));
  return { fixture, el, prev, next };
}

describe('sm-pagination (FR-008)', () => {
  it('mostra "Página X de Y" e o total', () => {
    const { el } = setup({ page: 2, pageSize: 20, totalCount: 45, totalPages: 3 });
    expect(el.textContent).toContain('Página 2 de 3');
    expect(el.textContent).toContain('45 itens');
  });

  it('desabilita "Anterior" na primeira página e "Próxima" na última', () => {
    expect(setup({ page: 1, pageSize: 20, totalCount: 45, totalPages: 3 }).prev?.disabled).toBe(
      true,
    );
    expect(setup({ page: 3, pageSize: 20, totalCount: 45, totalPages: 3 }).next?.disabled).toBe(
      true,
    );
  });

  it('emite a página seguinte e a anterior', () => {
    const { fixture, prev, next } = setup({ page: 2, pageSize: 20, totalCount: 45, totalPages: 3 });
    const pages: number[] = [];
    fixture.componentInstance.pageChange.subscribe((p) => pages.push(p));
    next?.click();
    prev?.click();
    expect(pages).toEqual([3, 1]);
  });

  it('emite o novo tamanho de página', () => {
    const { fixture, el } = setup({ page: 1, pageSize: 20, totalCount: 45, totalPages: 3 });
    const sizes: number[] = [];
    fixture.componentInstance.pageSizeChange.subscribe((s) => sizes.push(s));
    const select = el.querySelector('select') as HTMLSelectElement;
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    expect(sizes).toEqual([50]);
  });

  it('zero resultados exibe "Página 1 de 1"', () => {
    const { el } = setup({ page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
    expect(el.textContent).toContain('Página 1 de 1');
  });
});
