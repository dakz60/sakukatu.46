'use strict';

function normalize(value) {
  return value
    .trim()
    .replace(/[ァ-ン]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60)
    )
    .toLowerCase();
}

function isMember(value) {
  return members.some((member) => member.name === value);
}

function attachMemberAutocomplete(input, options = members) {
  if (!input || input.dataset.autocompleteReady) return;

  const candidates = options;

  input.dataset.autocompleteReady = 'true';
  input.autocomplete = 'off';
  input.placeholder = 'メンバー名を入力（例：た）';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');

  const picker = document.createElement('div');
  picker.className = 'member-picker';

  input.parentNode.insertBefore(picker, input);
  picker.append(input);

  const list = document.createElement('div');
  list.className = 'member-suggestions';
  list.id = `member-suggestions-${crypto.randomUUID()}`;
  list.setAttribute('role', 'listbox');
  list.hidden = true;

  input.setAttribute('aria-controls', list.id);
  picker.append(list);

  let activeIndex = -1;

  function closeSuggestions() {
    list.hidden = true;
    activeIndex = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function chooseMember(member) {
    input.value = member.name;
    input.dataset.memberSelected = 'true';
    closeSuggestions();
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function showMatches() {
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');

    const query = normalize(input.value);

    input.dataset.memberSelected = String(
      candidates.some((member) => member.name === input.value)
    );

    if (!query) {
      closeSuggestions();
      return;
    }

    const matches = candidates
      .filter((member) =>
        normalize(member.name).includes(query) ||
        normalize(member.kana).includes(query)
      )
      .slice(0, 8);

    list.replaceChildren();

    if (!matches.length) {
      closeSuggestions();
      return;
    }

    matches.forEach((member, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.id = `${list.id}-${index}`;
      option.className = 'member-suggestion';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');

      const name = document.createElement('strong');
      name.textContent = member.name;

      const kana = document.createElement('small');
      kana.textContent = member.kana;

      option.append(name, kana);

      option.addEventListener('mousedown', (event) => {
        event.preventDefault();
      });

      option.addEventListener('click', () => {
        chooseMember(member);
      });

      list.append(option);
    });

    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  input.addEventListener('input', showMatches);
  input.addEventListener('focus', showMatches);

  input.addEventListener('blur', () => {
    setTimeout(closeSuggestions, 120);
  });

  input.addEventListener('keydown', (event) => {
    const options = [...list.querySelectorAll('.member-suggestion')];

    if (list.hidden || !options.length) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();

      const direction = event.key === 'ArrowDown' ? 1 : -1;

      activeIndex = activeIndex < 0
        ? direction > 0
          ? 0
          : options.length - 1
        : (activeIndex + direction + options.length) % options.length;

      input.setAttribute(
        'aria-activedescendant',
        options[activeIndex].id
      );

      options.forEach((option, index) => {
        const isActive = index === activeIndex;
        option.classList.toggle('active', isActive);
        option.setAttribute('aria-selected', String(isActive));
      });
    } else if (event.key === 'Enter' && options[activeIndex]) {
      event.preventDefault();

      const selectedName =
        options[activeIndex].querySelector('strong').textContent;

      const member = candidates.find(
        (item) => item.name === selectedName
      );

      if (member) {
        chooseMember(member);
      }
    } else if (event.key === 'Escape') {
      closeSuggestions();
    }
  });
}
