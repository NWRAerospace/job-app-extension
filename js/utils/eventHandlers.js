// Event handlers utility module
export class EventHandlers {
  static setupFileInputHandler(fileInput, buttonElement) {
    fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        const buttonText = buttonElement.querySelector('.button-text');
        if (buttonText) {
          buttonText.textContent = `Upload "${file.name}"`;
        }
      }
    });
  }

  static setupLimitationToggleHandler(isTemporaryCheckbox, endDateInput) {
    isTemporaryCheckbox.addEventListener('change', function() {
      endDateInput.style.display = this.checked ? 'block' : 'none';
      if (!this.checked) {
        endDateInput.value = '';
      }
    });
  }

  static setupEducationToggleHandler(inProgressCheckbox, endDateInput) {
    inProgressCheckbox.addEventListener('change', function() {
      endDateInput.disabled = this.checked;
      if (this.checked) {
        endDateInput.value = '';
      }
    });
  }

  static setupEducationTypeHandler(typeSelect, urlInput, expiryInput, gpaInput) {
    typeSelect.addEventListener('change', function() {
      const isCertification = this.value === 'certification';
      urlInput.style.display = isCertification ? 'block' : 'none';
      expiryInput.style.display = isCertification ? 'block' : 'none';
      gpaInput.style.display = this.value === 'degree' ? 'block' : 'none';
    });
  }

  static setupLimitationFilterHandlers(filterButtons, updateCallback) {
    filterButtons.forEach(button => {
      button.addEventListener('click', async function() {
        filterButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        await updateCallback(this.dataset.category);
      });
    });
  }

  static setupSkillInputHandler(skillInput, addSkillButton) {
    skillInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSkillButton.click();
      }
    });
  }

  static setupModalHandlers(modal, onConfirm, onCancel) {
    const confirmButton = modal.querySelector('.confirm-button');
    const cancelButton = modal.querySelector('.cancel-button');
    
    if (confirmButton) {
      confirmButton.addEventListener('click', () => {
        onConfirm();
        modal.remove();
      });
    }
    
    if (cancelButton) {
      cancelButton.addEventListener('click', () => {
        if (onCancel) onCancel();
        modal.remove();
      });
    }
  }

  static preventFormSubmission(form) {
    form.addEventListener('submit', (e) => e.preventDefault());
  }

  static setupApiKeyHandler(apiKeyInput, saveButton, onSave) {
    saveButton.addEventListener('click', async () => {
      const apiKey = apiKeyInput.value;
      await onSave(apiKey);
    });
  }
} 