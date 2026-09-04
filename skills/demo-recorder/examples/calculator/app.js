// Tiny no-dependency calculator: enter a number, pick an operator, enter a
// second number, press = to compute. C clears. Result shows in #display.
(function () {
  const display = document.getElementById('display');

  let current = '0'; // the number being typed / the shown value
  let stored = null; // the left-hand operand once an operator is chosen
  let pendingOp = null; // the chosen operator, one of + - * /
  let replaceOnNextDigit = true; // start fresh on the next digit press

  function show(value) {
    display.textContent = String(value);
  }

  function inputDigit(d) {
    if (replaceOnNextDigit) {
      current = d;
      replaceOnNextDigit = false;
    } else {
      current = current === '0' ? d : current + d;
    }
    show(current);
  }

  function compute(a, b, op) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? 'Error' : a / b;
      default: return b;
    }
  }

  function chooseOp(op) {
    if (pendingOp !== null && !replaceOnNextDigit) {
      // chain: fold the current value into the running result first
      const result = compute(stored, Number(current), pendingOp);
      stored = typeof result === 'number' ? result : null;
      show(result);
    } else {
      stored = Number(current);
    }
    pendingOp = op;
    replaceOnNextDigit = true;
  }

  function equals() {
    if (pendingOp === null || stored === null) return;
    const result = compute(stored, Number(current), pendingOp);
    show(result);
    current = typeof result === 'number' ? String(result) : '0';
    stored = null;
    pendingOp = null;
    replaceOnNextDigit = true;
  }

  function clearAll() {
    current = '0';
    stored = null;
    pendingOp = null;
    replaceOnNextDigit = true;
    show('0');
  }

  document.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.digit !== undefined) {
        inputDigit(btn.dataset.digit);
      } else if (btn.dataset.op !== undefined) {
        chooseOp(btn.dataset.op);
      } else if (btn.dataset.action === 'equals') {
        equals();
      } else if (btn.dataset.action === 'clear') {
        clearAll();
      }
    });
  });

  show('0');
})();
