import { members } from '../data/features.js?v=20261030-3';

function normalize(value) {
  return value
    .trim()
    .replace(/[ァ-ン]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60)
    )
    .toLowerCase();
}

export function isMember(value) {
  return members.some((member) => member.name === value);
}

export function attachMemberAutocomplete(input) {
  if (!input || input.dataset.autocompleteReady) return;

  input.dataset.autocompleteReady = 'true';
  input.autocomplete = 'off';
  input.placeholder = 'メンバー名を入力（例：た）';
  input.setAttribute('aria-autocomplete', 'list');

  const picker = document.createElement('div');
  picker.className = 'member-picker';

  input.parentNode.insertBefore(picker, input);
  picker.append(input);

  const list = document.createElement('div');
  list.className = 'member-suggestions';
  list.hidden = true;
  picker.append(list);

  let activeIndex = -1;

  function closeSuggestions() {
    list.hidden = true;
    activeIndex = -1;
  }

  function chooseMember(member) {
    input.value = member.name;
    input.dataset.memberSelected = 'true';
    closeSuggestions();
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function showMatches() {
    const query = normalize(input.value);
    input.dataset.memberSelected = String(isMember(input.value));

    if (!query) {
      closeSuggestions();
      return;
    }

    const matches = members
      .filter((member) => {
        return (
          normalize(member.name).includes(query) ||
          normalize(member.kana).includes(query)
        );
      })
      .slice(0, 8);

    list.replaceChildren();

    if (matches.length === 0) {
      closeSuggestions();
      return;
    }

    matches.forEach((member, index) => {
      const option = document.createElement('button');
      option.type = 'button';
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

      if (index === activeIndex) {
        option.classList.add('active');
      }
    });

    list.hidden = false;
  }

  input.addEventListener('input', showMatches);
  input.addEventListener('focus', showMatches);

  input.addEventListener('blur', () => {
    setTimeout(closeSuggestions, 120);
  });

  input.addEventListener('keydown', (event) => {
    const options = [...list.querySelectorAll('.member-suggestion')];

    if (list.hidden || options.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();

      const direction = event.key === 'ArrowDown' ? 1 : -1;
      activeIndex = (activeIndex + direction + options.length) % options.length;

      options.forEach((option, index) => {
        const isActive = index === activeIndex;
        option.classList.toggle('active', isActive);
        option.setAttribute('aria-selected', String(isActive));
      });
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();

      const selectedName =
        options[activeIndex].querySelector('strong').textContent;

      const member = members.find((item) => item.name === selectedName);

      if (member) {
        chooseMember(member);
      }
    } else if (event.key === 'Escape') {
      closeSuggestions();
    }
  });
}
