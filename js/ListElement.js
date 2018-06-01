Vue.component('list-element', {
  props: ['content'],

  template: `<div v-html="content"></div>`
});
