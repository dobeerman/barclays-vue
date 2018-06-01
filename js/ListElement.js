Vue.component('list-element', {
  props: ['content', 'id'],

  template: `<li v-html="content" :id="id"></li>`,
});
