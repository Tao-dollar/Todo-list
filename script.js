const STORAGE_KEY = "daylight-todos-v1";
const THEME_STORAGE_KEY = "daylight-theme-v1";
const FILTERS = new Set(["all", "active", "completed"]);
const WEEKDAYS = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" },
];

function getCurrentDayKey() {
  return WEEKDAYS[(new Date().getDay() + 6) % 7].key;
}

let selectedDay = getCurrentDayKey();

const addForm = document.querySelector("#add-form");
const newTaskInput = document.querySelector("#new-task");
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const emptyTitle = document.querySelector("#empty-title");
const emptyCopy = document.querySelector("#empty-copy");
const clearCompletedButton = document.querySelector("#clear-completed");
const announcements = document.querySelector("#announcements");
const progressCount = document.querySelector("#progress-count");
const progressPercent = document.querySelector("#progress-percent");
const progressFill = document.querySelector("#progress-fill");
const progressTrack = document.querySelector("#progress-track");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const weekdayNav = document.querySelector("#weekday-nav");
const selectedDayTitle = document.querySelector("#selected-day-title");
const selectedDayCount = document.querySelector("#selected-day-count");
const progressLabel = document.querySelector("#progress-label");
const themeToggle = document.querySelector("#theme-toggle");
const themeIcon = themeToggle.querySelector(".theme-icon");
const installButton = document.querySelector("#install-button");

let tasks = loadTasks();
let currentFilter = "all";
let editingTaskId = null;
let deferredInstallPrompt = null;

function loadTasks() {
  try {
    const savedTasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(savedTasks)) return [];

    return savedTasks
      .filter(
        (task) =>
          task &&
          typeof task.id === "string" &&
          typeof task.text === "string" &&
          typeof task.completed === "boolean",
      )
      .map((task) => ({
        id: task.id,
        text: task.text,
        completed: task.completed,
        day: WEEKDAYS.some((weekday) => weekday.key === task.day)
          ? task.day
          : getCurrentDayKey(),
      }));
  } catch {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    announce("Your browser could not save changes to this device.");
  }
}

function announce(message) {
  announcements.textContent = "";
  window.requestAnimationFrame(() => {
    announcements.textContent = message;
  });
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getVisibleTasks() {
  const dayTasks = tasks.filter((task) => task.day === selectedDay);
  if (currentFilter === "active")
    return dayTasks.filter((task) => !task.completed);
  if (currentFilter === "completed")
    return dayTasks.filter((task) => task.completed);
  return dayTasks;
}

function getWeekStartDate() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function getSelectedDayDate() {
  const date = getWeekStartDate();
  date.setDate(
    date.getDate() + WEEKDAYS.findIndex((day) => day.key === selectedDay),
  );
  return date;
}

function renderWeekdays() {
  const weekStart = getWeekStartDate();
  weekdayNav.replaceChildren();

  WEEKDAYS.forEach((weekday, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);

    const button = document.createElement("button");
    button.className = "weekday-button";
    button.type = "button";
    button.dataset.day = weekday.key;
    button.setAttribute("aria-pressed", String(weekday.key === selectedDay));
    button.setAttribute(
      "aria-label",
      `${weekday.label}, ${new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(date)}`,
    );

    const name = document.createElement("span");
    name.className = "weekday-name";
    name.textContent = weekday.short;

    const dateNumber = document.createElement("span");
    dateNumber.className = "weekday-date";
    dateNumber.textContent = String(date.getDate());

    const count = document.createElement("span");
    count.className = "weekday-count";
    count.setAttribute("aria-hidden", "true");

    button.append(name, dateNumber, count);
    weekdayNav.append(button);
  });

  updateWeekdayCounts();
}

function updateWeekdayCounts() {
  for (const button of weekdayNav.querySelectorAll(".weekday-button")) {
    const count = tasks.filter(
      (task) => task.day === button.dataset.day,
    ).length;
    button.querySelector(".weekday-count").textContent = count
      ? String(count)
      : "";
    const isSelected = button.dataset.day === selectedDay;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }
}

function applyTheme(theme, { save = false } = {}) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]').content = isDark
    ? "#151b16"
    : "#f7f7f2";
  themeIcon.textContent = isDark ? "☀" : "☾";
  const nextTheme = isDark ? "light" : "dark";
  themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
  themeToggle.title = `Switch to ${nextTheme} mode`;

  if (save) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
    } catch {
      announce("Your browser could not save the theme preference.");
    }
  }
}

function createActionButton(action, label, symbol) {
  const button = document.createElement("button");
  button.className = "icon-button";
  button.type = "button";
  button.dataset.action = action;
  button.setAttribute("aria-label", label);
  button.textContent = symbol;
  return button;
}

function createTaskElement(task) {
  const item = document.createElement("li");
  item.className = `task-item${task.completed ? " is-complete" : ""}`;
  item.dataset.id = task.id;

  const toggleButton = document.createElement("button");
  toggleButton.className = "task-toggle";
  toggleButton.type = "button";
  toggleButton.dataset.action = "toggle";
  toggleButton.setAttribute("aria-pressed", String(task.completed));
  toggleButton.setAttribute(
    "aria-label",
    `${task.completed ? "Mark as to do" : "Mark as done"}: ${task.text}`,
  );
  const checkmark = document.createElement("span");
  checkmark.setAttribute("aria-hidden", "true");
  checkmark.textContent = task.completed ? "✓" : "";
  toggleButton.append(checkmark);
  item.append(toggleButton);

  if (editingTaskId === task.id) {
    const editForm = document.createElement("form");
    editForm.className = "edit-form";
    editForm.dataset.id = task.id;

    const editInput = document.createElement("input");
    editInput.className = "edit-input";
    editInput.name = "task";
    editInput.type = "text";
    editInput.maxLength = 180;
    editInput.required = true;
    editInput.value = task.text;
    editInput.setAttribute("aria-label", "Edit task");

    const saveButton = document.createElement("button");
    saveButton.className = "edit-save";
    saveButton.type = "submit";
    saveButton.textContent = "Save";

    const cancelButton = document.createElement("button");
    cancelButton.className = "edit-cancel";
    cancelButton.type = "button";
    cancelButton.dataset.action = "cancel-edit";
    cancelButton.textContent = "Cancel";

    editForm.append(editInput, saveButton, cancelButton);
    item.append(editForm);
  } else {
    const content = document.createElement("span");
    content.className = "task-content";
    content.textContent = task.text;
    item.append(content);

    const actions = document.createElement("div");
    actions.className = "task-actions";
    actions.append(
      createActionButton("edit", `Edit task: ${task.text}`, "✎"),
      createActionButton("delete", `Delete task: ${task.text}`, "×"),
    );
    item.append(actions);
  }

  return item;
}

function renderTasks({ focusEdit = false } = {}) {
  const visibleTasks = getVisibleTasks();
  const dayTasks = tasks.filter((task) => task.day === selectedDay);
  const completedCount = dayTasks.filter((task) => task.completed).length;
  const activeCount = dayTasks.length - completedCount;
  const percent = dayTasks.length
    ? Math.round((completedCount / dayTasks.length) * 100)
    : 0;

  taskList.replaceChildren(...visibleTasks.map(createTaskElement));
  taskList.hidden = visibleTasks.length === 0;
  emptyState.hidden = visibleTasks.length !== 0;

  if (dayTasks.length === 0) {
    emptyTitle.textContent = "A clean slate.";
    emptyCopy.textContent = `Add a task above and make ${selectedDay} yours.`;
  } else if (currentFilter === "active" && activeCount === 0) {
    emptyTitle.textContent = "All caught up.";
    emptyCopy.textContent =
      "You’ve completed every task. Take a little breather.";
  } else if (currentFilter === "completed" && completedCount === 0) {
    emptyTitle.textContent = "Nothing done just yet.";
    emptyCopy.textContent = "Finished tasks will show up here.";
  }

  document.querySelector("#all-count").textContent = String(dayTasks.length);
  document.querySelector("#active-count").textContent = String(activeCount);
  document.querySelector("#completed-count").textContent =
    String(completedCount);
  clearCompletedButton.disabled = completedCount === 0;

  const weekday = WEEKDAYS.find((day) => day.key === selectedDay);
  const titleCaseDay = weekday.label;
  progressLabel.textContent = `${titleCaseDay.toUpperCase()}’S PROGRESS`;
  selectedDayTitle.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(getSelectedDayDate());
  selectedDayCount.textContent = `${dayTasks.length} ${dayTasks.length === 1 ? "task" : "tasks"}`;
  newTaskInput.placeholder = `Add a task for ${titleCaseDay}...`;

  if (dayTasks.length === 0) {
    progressCount.textContent = "You’re just getting started";
  } else if (completedCount === dayTasks.length) {
    progressCount.textContent = "Everything’s done. Lovely work!";
  } else {
    progressCount.textContent = `${completedCount} of ${dayTasks.length} ${dayTasks.length === 1 ? "task" : "tasks"} complete`;
  }
  progressPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
  progressTrack.setAttribute("aria-valuenow", String(percent));
  updateWeekdayCounts();

  for (const button of filterButtons) {
    const isActive = button.dataset.filter === currentFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  if (focusEdit) {
    const editInput = taskList.querySelector(".edit-input");
    editInput?.focus();
    editInput?.select();
  }
}

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = newTaskInput.value.trim();
  if (!text) {
    newTaskInput.focus();
    return;
  }

  tasks.unshift({ id: createId(), text, completed: false, day: selectedDay });
  currentFilter = "all";
  saveTasks();
  renderTasks();
  addForm.reset();
  newTaskInput.focus();
  announce(`Added task: ${text}`);
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = FILTERS.has(button.dataset.filter)
      ? button.dataset.filter
      : "all";
    editingTaskId = null;
    renderTasks();
  });
});

weekdayNav.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-day]");
  if (!button) return;
  selectedDay = button.dataset.day;
  editingTaskId = null;
  renderTasks();
});

themeToggle.addEventListener("click", () => {
  const nextTheme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme, { save: true });
  announce(`${nextTheme === "dark" ? "Dark" : "Light"} mode enabled.`);
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.textContent = "Install app";
});

installButton.addEventListener("click", async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    announce(
      outcome === "accepted"
        ? "Daylight is being installed."
        : "App installation was dismissed.",
    );
    deferredInstallPrompt = null;
    return;
  }

  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  announce(
    isIOS
      ? "To install Daylight, tap Share, then Add to Home Screen."
      : "To install Daylight, open your browser menu and choose Install app or Add to Home screen.",
  );
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.hidden = true;
  announce("Daylight has been installed.");
});

if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
  installButton.hidden = true;
}

taskList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const item = button.closest(".task-item");
  const task = tasks.find((entry) => entry.id === item?.dataset.id);
  if (!task) return;

  switch (button.dataset.action) {
    case "toggle":
      task.completed = !task.completed;
      saveTasks();
      renderTasks();
      announce(`${task.text} marked ${task.completed ? "done" : "to do"}.`);
      break;
    case "edit":
      editingTaskId = task.id;
      renderTasks({ focusEdit: true });
      break;
    case "delete":
      tasks = tasks.filter((entry) => entry.id !== task.id);
      editingTaskId = null;
      saveTasks();
      renderTasks();
      announce(`Deleted task: ${task.text}`);
      break;
    case "cancel-edit":
      editingTaskId = null;
      renderTasks();
      break;
  }
});

taskList.addEventListener("submit", (event) => {
  const editForm = event.target.closest(".edit-form");
  if (!editForm) return;
  event.preventDefault();

  const task = tasks.find((entry) => entry.id === editForm.dataset.id);
  const input = editForm.elements.task;
  const text = input.value.trim();
  if (!task || !text) {
    input.focus();
    return;
  }

  task.text = text;
  editingTaskId = null;
  saveTasks();
  renderTasks();
  announce(`Updated task: ${text}`);
});

taskList.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && event.target.matches(".edit-input")) {
    editingTaskId = null;
    renderTasks();
    announce("Edit canceled.");
  }
});

clearCompletedButton.addEventListener("click", () => {
  const removedCount = tasks.filter(
    (task) => task.day === selectedDay && task.completed,
  ).length;
  if (!removedCount) return;
  tasks = tasks.filter((task) => task.day !== selectedDay || !task.completed);
  editingTaskId = null;
  saveTasks();
  renderTasks();
  announce(
    `Cleared ${removedCount} completed ${removedCount === 1 ? "task" : "tasks"}.`,
  );
});

const today = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date());
document.querySelector("#today-date").textContent = today;

let savedTheme = "light";
try {
  savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "light";
} catch {
  // Keep the default light theme when storage is unavailable.
}
applyTheme(savedTheme);
renderWeekdays();
renderTasks();

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      announce("Offline support could not be enabled in this browser.");
    });
  });
}
