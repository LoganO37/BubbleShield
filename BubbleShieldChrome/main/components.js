'use strict';

/* ============================================================
   Bubble Shield — Reusable UI Components
   ChipInput, TabBar, ToggleSwitch, Toast, ConfirmModal, CollapsibleSection
   ============================================================ */

// ─── ChipInput ──────────────────────────────────────────────

class ChipInput {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Element to render into
   * @param {string[]} [options.initialValues=[]]
   * @param {string} [options.placeholder='Type and press Enter']
   * @param {Set<string>} [options.defaultValues=new Set()] - Values that get "default" chip style
   * @param {function(string):string} [options.normalize] - Normalization function
   * @param {string} [options.ariaLabel='']
   * @param {function} [options.onChange] - Called when chips change
   */
  constructor(options) {
    this.container = options.container;
    this.placeholder = options.placeholder || 'Type and press Enter';
    this.defaultValues = options.defaultValues || new Set();
    this.normalize = options.normalize || (v => v.trim());
    this.ariaLabel = options.ariaLabel || 'Chip input';
    this.onChange = options.onChange || null;

    this._values = [];
    this._initialValues = [];
    this._chips = [];

    this._render();
    if (options.initialValues) {
      this.setValues(options.initialValues);
    }
  }

  _render() {
    this.el = document.createElement('div');
    this.el.className = 'chip-input';
    this.el.setAttribute('role', 'listbox');
    this.el.setAttribute('aria-label', this.ariaLabel);

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'chip-input__field';
    this.input.placeholder = this.placeholder;
    this.input.setAttribute('aria-label', 'Add new item');

    this.el.appendChild(this.input);
    this.container.appendChild(this.el);

    // Click container to focus input
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.input.focus();
    });

    // Keyboard events on input
    this.input.addEventListener('keydown', (e) => this._onKeydown(e));
    this.input.addEventListener('paste', (e) => this._onPaste(e));
  }

  _onKeydown(e) {
    const val = this.input.value;

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = val.replace(/,/g, '').trim();
      if (trimmed) {
        this.addChip(trimmed);
        this.input.value = '';
      }
    } else if (e.key === 'Backspace' && val === '' && this._values.length > 0) {
      this.removeChip(this._values.length - 1);
    }
  }

  _onPaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const lines = text.split(/[\n,]+/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length > 1) {
      lines.forEach(line => this.addChip(line));
      this.input.value = '';
    } else if (lines.length === 1) {
      // Single value paste — let it go into the input field for editing
      this.input.value += lines[0];
    }
  }

  _createChipEl(value, index) {
    const normalized = this.normalize(value);
    const isDefault = this.defaultValues.has(normalized);

    const chip = document.createElement('div');
    chip.className = `chip ${isDefault ? 'chip--default' : 'chip--user'}`;
    chip.setAttribute('role', 'option');

    const text = document.createElement('span');
    text.className = 'chip__text';
    text.textContent = value;
    chip.appendChild(text);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'chip__remove';
    remove.setAttribute('aria-label', `Remove ${value}`);
    remove.innerHTML = '&times;';
    remove.addEventListener('click', () => {
      const idx = this._values.indexOf(value);
      if (idx !== -1) this.removeChip(idx);
    });
    chip.appendChild(remove);

    return chip;
  }

  _rebuildChips() {
    // Remove all existing chip elements
    this._chips.forEach(c => c.remove());
    this._chips = [];

    // Create new chip elements before the input
    this._values.forEach((val, i) => {
      const chipEl = this._createChipEl(val, i);
      this.el.insertBefore(chipEl, this.input);
      this._chips.push(chipEl);
    });
  }

  _fireChange() {
    if (this.onChange) this.onChange(this.getValues());
  }

  /** @returns {string[]} */
  getValues() {
    return [...this._values];
  }

  /** @param {string[]} values */
  setValues(values) {
    this._values = [...values];
    this._initialValues = [...values];
    this._rebuildChips();
  }

  /** @param {string} value */
  addChip(value) {
    const normalized = this.normalize(value);
    if (!normalized) return;

    // Check for duplicates
    const exists = this._values.some(v => this.normalize(v) === normalized);
    if (exists) return;

    this._values.push(normalized);
    const chipEl = this._createChipEl(normalized, this._values.length - 1);
    this.el.insertBefore(chipEl, this.input);
    this._chips.push(chipEl);
    this._fireChange();
  }

  /** @param {number} index */
  removeChip(index) {
    if (index < 0 || index >= this._values.length) return;
    this._values.splice(index, 1);
    this._rebuildChips();
    this._fireChange();
  }

  /** @returns {boolean} */
  isDirty() {
    if (this._values.length !== this._initialValues.length) return true;
    return this._values.some((v, i) => v !== this._initialValues[i]);
  }

  markClean() {
    this._initialValues = [...this._values];
  }

  destroy() {
    this.el.remove();
  }
}

// ─── ToggleSwitch ───────────────────────────────────────────

class ToggleSwitch {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container
   * @param {boolean} [options.checked=false]
   * @param {function(boolean)} [options.onChange]
   * @param {string} [options.ariaLabel='Toggle']
   */
  constructor(options) {
    this.container = options.container;
    this._checked = options.checked || false;
    this.onChange = options.onChange || null;
    this.ariaLabel = options.ariaLabel || 'Toggle';

    this._render();
  }

  _render() {
    this.el = document.createElement('div');
    this.el.className = 'toggle-track' + (this._checked ? ' toggle-track--checked' : '');
    this.el.setAttribute('role', 'switch');
    this.el.setAttribute('aria-checked', String(this._checked));
    this.el.setAttribute('aria-label', this.ariaLabel);
    this.el.setAttribute('tabindex', '0');

    this.thumb = document.createElement('div');
    this.thumb.className = 'toggle-thumb';
    this.el.appendChild(this.thumb);

    this.container.appendChild(this.el);

    this.el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setChecked(!this._checked);
    });

    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        this.setChecked(!this._checked);
      }
    });
  }

  /** @returns {boolean} */
  isChecked() {
    return this._checked;
  }

  /** @param {boolean} checked */
  setChecked(checked) {
    this._checked = checked;
    this.el.classList.toggle('toggle-track--checked', checked);
    this.el.setAttribute('aria-checked', String(checked));
    if (this.onChange) this.onChange(checked);
  }

  destroy() {
    this.el.remove();
  }
}

// ─── TabBar ─────────────────────────────────────────────────

class TabBar {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container
   * @param {Array<{id:string, label:string, count:number, hasToggle?:boolean, enabled?:boolean}>} options.tabs
   * @param {string} options.activeTabId
   * @param {function(string)} options.onTabChange
   * @param {function(string, boolean)} [options.onToggleChange]
   */
  constructor(options) {
    this.container = options.container;
    this.tabs = options.tabs;
    this._activeTabId = options.activeTabId;
    this.onTabChange = options.onTabChange;
    this.onToggleChange = options.onToggleChange || null;

    this._tabEls = {};
    this._toggles = {};
    this._countEls = {};

    this._render();
  }

  _render() {
    this.el = document.createElement('div');
    this.el.className = 'tab-bar';
    this.el.setAttribute('role', 'tablist');
    this.el.setAttribute('aria-label', 'Keyword lists');

    this.tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab' + (tab.id === this._activeTabId ? ' tab--active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(tab.id === this._activeTabId));
      btn.setAttribute('aria-controls', `panel-${tab.id}`);
      btn.id = `tab-${tab.id}`;
      btn.setAttribute('tabindex', tab.id === this._activeTabId ? '0' : '-1');

      // Toggle (if applicable)
      if (tab.hasToggle) {
        const toggleContainer = document.createElement('span');
        toggleContainer.className = 'tab__toggle';
        const toggle = new ToggleSwitch({
          container: toggleContainer,
          checked: tab.enabled || false,
          ariaLabel: `Enable ${tab.label} list`,
          onChange: (checked) => {
            if (this.onToggleChange) this.onToggleChange(tab.id, checked);
          }
        });
        btn.appendChild(toggleContainer);
        this._toggles[tab.id] = toggle;
      }

      // Label
      const label = document.createElement('span');
      label.className = 'tab__label';
      label.textContent = tab.label;
      btn.appendChild(label);

      // Count badge
      const count = document.createElement('span');
      count.className = 'tab__count';
      count.textContent = String(tab.count || 0);
      btn.appendChild(count);
      this._countEls[tab.id] = count;

      // Tab click (but not toggle area)
      btn.addEventListener('click', (e) => {
        // Toggle clicks are handled by ToggleSwitch via stopPropagation
        if (tab.id !== this._activeTabId) {
          this.setActiveTab(tab.id);
          this.onTabChange(tab.id);
        }
      });

      this.el.appendChild(btn);
      this._tabEls[tab.id] = btn;
    });

    // Keyboard navigation
    this.el.addEventListener('keydown', (e) => {
      const tabIds = this.tabs.map(t => t.id);
      const idx = tabIds.indexOf(this._activeTabId);
      if (e.key === 'ArrowRight' && idx < tabIds.length - 1) {
        e.preventDefault();
        this.setActiveTab(tabIds[idx + 1]);
        this.onTabChange(tabIds[idx + 1]);
        this._tabEls[tabIds[idx + 1]].focus();
      } else if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault();
        this.setActiveTab(tabIds[idx - 1]);
        this.onTabChange(tabIds[idx - 1]);
        this._tabEls[tabIds[idx - 1]].focus();
      }
    });

    this.container.appendChild(this.el);
  }

  getActiveTabId() {
    return this._activeTabId;
  }

  setActiveTab(tabId) {
    // Deactivate old
    const oldEl = this._tabEls[this._activeTabId];
    if (oldEl) {
      oldEl.classList.remove('tab--active');
      oldEl.setAttribute('aria-selected', 'false');
      oldEl.setAttribute('tabindex', '-1');
    }

    // Activate new
    this._activeTabId = tabId;
    const newEl = this._tabEls[tabId];
    if (newEl) {
      newEl.classList.add('tab--active');
      newEl.setAttribute('aria-selected', 'true');
      newEl.setAttribute('tabindex', '0');
    }
  }

  setTabCount(tabId, count) {
    const el = this._countEls[tabId];
    if (el) el.textContent = String(count);
  }

  setTabEnabled(tabId, enabled) {
    const toggle = this._toggles[tabId];
    if (toggle) toggle.setChecked(enabled);
  }

  getEnabledStates() {
    const states = {};
    for (const tab of this.tabs) {
      if (tab.hasToggle) {
        states[tab.id] = this._toggles[tab.id].isChecked();
      }
    }
    return states;
  }

  destroy() {
    Object.values(this._toggles).forEach(t => t.destroy());
    this.el.remove();
  }
}

// ─── Toast ──────────────────────────────────────────────────

class Toast {
  static _container = null;
  static _timeout = null;

  /**
   * @param {string} message
   * @param {'success'|'error'|'info'} [type='success']
   * @param {number} [duration=3000]
   */
  static show(message, type = 'success', duration = 3000) {
    Toast.dismiss();

    if (!Toast._container) {
      Toast._container = document.createElement('div');
      Toast._container.className = 'toast-container';
      Toast._container.setAttribute('aria-live', 'polite');
      Toast._container.setAttribute('role', 'alert');
      document.body.appendChild(Toast._container);
    }

    const icons = { success: '\u2713', error: '\u2717', info: '\u2139' };
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const iconSpan = document.createElement('span');
    iconSpan.textContent = icons[type] || '';
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    Toast._container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('toast--visible');
      });
    });

    Toast._timeout = setTimeout(() => {
      Toast.dismiss();
    }, duration);
  }

  static dismiss() {
    if (Toast._timeout) {
      clearTimeout(Toast._timeout);
      Toast._timeout = null;
    }
    if (Toast._container) {
      const existing = Toast._container.querySelector('.toast');
      if (existing) {
        existing.classList.remove('toast--visible');
        setTimeout(() => existing.remove(), 300);
      }
    }
  }
}

// ─── ConfirmModal ───────────────────────────────────────────

class ConfirmModal {
  /**
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.message
   * @param {string} [options.confirmText='Confirm']
   * @param {string} [options.cancelText='Cancel']
   * @param {'danger'|'default'} [options.confirmStyle='default']
   * @returns {Promise<boolean>}
   */
  static confirm(options) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'modal-title');

      const modal = document.createElement('div');
      modal.className = 'modal';

      const title = document.createElement('h3');
      title.className = 'modal__title';
      title.id = 'modal-title';
      title.textContent = options.title;
      modal.appendChild(title);

      const message = document.createElement('p');
      message.className = 'modal__message';
      message.textContent = options.message;
      modal.appendChild(message);

      const actions = document.createElement('div');
      actions.className = 'modal__actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'modal__btn modal__btn--cancel';
      cancelBtn.textContent = options.cancelText || 'Cancel';
      actions.appendChild(cancelBtn);

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      const style = options.confirmStyle === 'danger' ? 'modal__btn--danger' : 'modal__btn--confirm';
      confirmBtn.className = `modal__btn ${style}`;
      confirmBtn.textContent = options.confirmText || 'Confirm';
      actions.appendChild(confirmBtn);

      modal.appendChild(actions);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Focus the cancel button (safe default)
      cancelBtn.focus();

      const cleanup = (result) => {
        overlay.remove();
        document.removeEventListener('keydown', keyHandler);
        resolve(result);
      };

      cancelBtn.addEventListener('click', () => cleanup(false));
      confirmBtn.addEventListener('click', () => cleanup(true));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(false);
      });

      // Keyboard: Escape to cancel, Tab trap
      const keyHandler = (e) => {
        if (e.key === 'Escape') {
          cleanup(false);
        } else if (e.key === 'Tab') {
          const focusable = [cancelBtn, confirmBtn];
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      document.addEventListener('keydown', keyHandler);
    });
  }
}

// ─── CollapsibleSection ─────────────────────────────────────

class CollapsibleSection {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container
   * @param {string} options.title
   * @param {boolean} [options.initiallyOpen=true]
   * @param {string} [options.ariaLabel]
   */
  constructor(options) {
    this.container = options.container;
    this._open = options.initiallyOpen !== false;
    this.title = options.title;
    this.ariaLabel = options.ariaLabel || options.title;

    this._id = 'collapsible-' + Math.random().toString(36).substring(2, 8);
    this._render();
  }

  _render() {
    this.el = document.createElement('div');
    this.el.className = 'collapsible' + (this._open ? ' collapsible--open' : '');

    this.header = document.createElement('button');
    this.header.type = 'button';
    this.header.className = 'collapsible__header';
    this.header.setAttribute('aria-expanded', String(this._open));
    this.header.setAttribute('aria-controls', this._id);

    const titleSpan = document.createElement('span');
    titleSpan.textContent = this.title;
    this.header.appendChild(titleSpan);

    const icon = document.createElement('span');
    icon.className = 'collapsible__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '&#9660;';
    this.header.appendChild(icon);

    this.content = document.createElement('div');
    this.content.className = 'collapsible__content';
    this.content.id = this._id;
    this.content.setAttribute('role', 'region');
    this.content.setAttribute('aria-label', this.ariaLabel);
    if (!this._open) {
      this.content.setAttribute('aria-hidden', 'true');
    }

    this.el.appendChild(this.header);
    this.el.appendChild(this.content);
    this.container.appendChild(this.el);

    this.header.addEventListener('click', () => this.toggle());
  }

  toggle() {
    if (this._open) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this._open = true;
    this.el.classList.add('collapsible--open');
    this.header.setAttribute('aria-expanded', 'true');
    this.content.removeAttribute('aria-hidden');
  }

  close() {
    this._open = false;
    this.el.classList.remove('collapsible--open');
    this.header.setAttribute('aria-expanded', 'false');
    this.content.setAttribute('aria-hidden', 'true');
  }

  /** @returns {HTMLElement} */
  getContent() {
    return this.content;
  }

  destroy() {
    this.el.remove();
  }
}
