// Tiny no-dependency todo app: add todos and mark them complete.
(function () {
  const input = document.getElementById('new-todo');
  const addBtn = document.getElementById('add-btn');
  const list = document.getElementById('todo-list');
  const count = document.getElementById('count');

  const todos = [];

  function render() {
    list.innerHTML = '';
    todos.forEach((todo, i) => {
      const li = document.createElement('li');
      li.className = todo.done ? 'done' : '';
      li.dataset.index = String(i);

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = todo.done;
      cb.setAttribute('aria-label', 'Complete ' + todo.title);
      cb.className = 'toggle';
      cb.addEventListener('change', () => {
        todo.done = cb.checked;
        render();
      });

      const span = document.createElement('span');
      span.className = 'title';
      span.textContent = todo.title;

      li.appendChild(cb);
      li.appendChild(span);
      list.appendChild(li);
    });
    const remaining = todos.filter((t) => !t.done).length;
    count.textContent = remaining + ' remaining';
  }

  function addTodo() {
    const title = input.value.trim();
    if (!title) return;
    todos.push({ title, done: false });
    input.value = '';
    render();
  }

  addBtn.addEventListener('click', addTodo);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTodo();
  });

  render();
})();
