
import { ComponentTreeExp } from './component/component-exp';

const displayNode = document.createElement('div');
document.body.append(displayNode);


class NodeDisplay extends HTMLElement {

  constructor() {
    super();

    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
<style>
:host {
  display: inline-block;
}
</style>
<div style="margin: 4px; border: 2px solid black; padding: 4px;">
<div style="text-align: center">
<slot name="title"></slot>
<small>
<slot name="info"></slot>
</small>
</div>
<div style="display: flex">
  <slot></slot>
</div>
</div>
    `;
  }

}
customElements.define('node-display', NodeDisplay);


const cr = (el: string, attr: any) => {
  return Object.assign(document.createElement(el), attr);
};
const ap = (target: HTMLElement, el: string, attr: any) => {
  target.append(cr(el, attr));
};

class Wrap extends ComponentTreeExp<string> {

  add(a: string, b: string): boolean {
    try {
      return super.add(a, b);
    } finally {
      this.refresh();
    }
  }

  makeRoot(node: string): void {
    try {
      return super.makeRoot(node);
    } finally {
      this.refresh();
    }
  }

  delete(a: string, b: string): boolean {
    try {
      return super.delete(a, b);
    } finally {
      this.refresh();
    }
  }

  refresh() {
    console.info('nodes', this._nodesForTest());

    const test = this._nodesForTest();
    displayNode.innerHTML = '';

    const nodeNode = new Map<string, HTMLElement>();
    for (const node of this.nodes()) {
      const h = document.createElement('node-display')
      h.className = 'node';

      ap(h, 'h2', { textContent: node, slot: 'title' });

      const td = test.get(node);
      const friendString = [...td?.friend ?? []].map((f) => f.id).join(',');
      ap(h, 'div', { textContent: `f=` + friendString, slot: 'info' });

      const familyFriendString = [...td?.familyFriend.entries() ?? []].map(([f, count]) => `${f.id}\{${count}\}`).join(',');
      ap(h, 'div', { textContent: `ff=` + familyFriendString, slot: 'info' });

      nodeNode.set(node, h);
    }

    for (const node of this.nodes()) {
      const n = nodeNode.get(node)!;

      const p = this.parentOf(node);
      if (p !== undefined) {
        nodeNode.get(p)!.append(n);
      } else {
        displayNode.append(n)
      }
    }

  }

}


const t = new Wrap();
// @ts-ignore
window.t = t;


const check = (cond: boolean) => {
  if (!cond) {
    throw new Error(`invariant fail`);
  }
}


t.add('root', 'x');
t.add('root', 'y');
t.add('y', 'z');
t.add('z', 'x');
//check(t.add('z', 'root'));
