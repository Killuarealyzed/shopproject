import { supabase, storage } from './supabase.js';
import { ADMIN_PASSWORD } from './config.js';

let currentOrderId = null;
let uploadedFileUrl = null;

// === Вход ===
document.getElementById('loginBtn')?.addEventListener('click', () => {
  const pass = document.getElementById('adminPass').value;
  if (pass === ADMIN_PASSWORD) {
    document.getElementById('adminLogin').classList.remove('active');
    document.getElementById('adminPanel').classList.add('active');
    loadOrders();
  } else {
    document.getElementById('loginError').style.display = 'block';
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  document.getElementById('adminLogin').classList.add('active');
  document.getElementById('adminPanel').classList.remove('active');
  document.getElementById('adminPass').value = '';
  document.getElementById('loginError').style.display = 'none';
});

// === Загрузка заказов ===
async function loadOrders() {
  const filter = document.getElementById('filterStatus')?.value || '';
  const search = document.getElementById('searchQuery')?.value?.toLowerCase() || '';
  
  let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (filter) query = query.eq('status', filter);
  
  const { data, error } = await query;
  if (error) return console.error('Orders error:', error);
  
  const filtered = data.filter(o => 
    !search || 
    o.client_name?.toLowerCase().includes(search) || 
    o.description?.toLowerCase().includes(search)
  );
  
  const list = document.getElementById('ordersList');
  if (!list) return;
  
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">📭 Заказов не найдено</div>';
    return;
  }
  
  list.innerHTML = filtered.map(order => `
    <div class="order-item" onclick="openOrder(${order.id})">
      <div class="order-item__info">
        <strong>#${order.id}</strong> — ${order.client_name}
        <div class="order-item__meta">${order.service_type} • ${new Date(order.created_at).toLocaleString('ru')}</div>
      </div>
      <span class="status-badge status-${order.status}">
        ${{'new':'🆕 Новый','in_progress':'🔄 В работе','completed':'✅ Готов'}[order.status] || order.status}
      </span>
    </div>
  `).join('');
}

// Фильтрация
document.getElementById('filterStatus')?.addEventListener('change', loadOrders);
document.getElementById('searchQuery')?.addEventListener('input', (e) => {
  if (e.target.value.length >= 2 || e.target.value === '') loadOrders();
});

// === Модальное окно заказа ===
window.openOrder = async (id) => {
  currentOrderId = id;
  uploadedFileUrl = null;
  
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return;
  
  document.getElementById('modalOrderId').textContent = data.id;
  document.getElementById('modalClient').textContent = data.client_name;
  document.getElementById('modalEmail').textContent = data.client_email || '—';
  document.getElementById('modalType').textContent = data.service_type;
  document.getElementById('modalDate').textContent = new Date(data.created_at).toLocaleString('ru');
  document.getElementById('modalStatus').value = data.status;
  document.getElementById('modalSecret').textContent = data.client_secret;
  document.getElementById('modalDesc').textContent = data.description;
  
  // Текущий файл
  const currentFileEl = document.getElementById('currentFile');
  if (data.result_file_url) {
    currentFileEl.innerHTML = `📄 Текущий файл: <a href="${data.result_file_url}" target="_blank">Открыть</a>`;
    uploadedFileUrl = data.result_file_url;
  } else {
    currentFileEl.textContent = '';
  }
  
  document.getElementById('orderModal').classList.add('active');
  document.getElementById('uploadStatus').textContent = '';
  document.getElementById('resultFile').value = '';
  document.getElementById('fileLabel').textContent = '📎 Нажмите или перетащите файл для загрузки';
};

// Закрытие модального окна
document.querySelector('#orderModal .modal__close').onclick = () => {
  document.getElementById('orderModal').classList.remove('active');
  currentOrderId = null;
};

// === Сохранение заказа ===
document.getElementById('saveOrderBtn')?.addEventListener('click', async () => {
  if (!currentOrderId) return;
  
  const status = document.getElementById('modalStatus').value;
  
  const { error } = await supabase
    .from('orders')
    .update({ 
      status, 
      result_file_url: uploadedFileUrl 
    })
    .eq('id', currentOrderId);
  
  if (error) {
    alert('❌ Ошибка: ' + error.message);
  } else {
    alert('✅ Заказ обновлён');
    loadOrders();
    document.getElementById('orderModal').classList.remove('active');
  }
});

// === Загрузка файла ===
document.getElementById('resultFile')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !currentOrderId) return;
  
  const statusEl = document.getElementById('uploadStatus');
  const labelEl = document.getElementById('fileLabel');
  
  // Валидация
  const maxSize = 50 * 1024 * 1024; // 50 MB
  if (file.size > maxSize) {
    statusEl.textContent = '❌ Файл слишком большой (макс. 50 МБ)';
    statusEl.style.color = 'var(--danger)';
    return;
  }
  
  labelEl.textContent = `⏳ Загрузка: ${file.name}...`;
  statusEl.textContent = '';
  
  try {
    // Уникальное имя файла
    const ext = file.name.split('.').pop();
    const fileName = `order-${currentOrderId}-${Date.now()}.${ext}`;
    
    // Загрузка в Supabase Storage
    const { error: uploadError, data: uploadData } = await storage
      .upload(fileName, file, { upsert: true });
    
    if (uploadError) throw uploadError;
    
    // Получаем публичную ссылку
    const { data: { publicUrl } } = storage.getPublicUrl(fileName);
    uploadedFileUrl = publicUrl;
    
    labelEl.textContent = `✅ ${file.name}`;
    statusEl.textContent = 'Файл загружен. Нажмите "Сохранить", чтобы применить.';
    statusEl.style.color = 'var(--success)';
    
  } catch (err) {
    console.error('Upload error:', err);
    statusEl.textContent = `❌ Ошибка загрузки: ${err.message}`;
    statusEl.style.color = 'var(--danger)';
    labelEl.textContent = '📎 Нажмите или перетащите файл для загрузки';
  }
});

// === Копирование ссылки для клиента ===
document.getElementById('copyLinkBtn')?.addEventListener('click', async () => {
  if (!currentOrderId) return;
  
  const { data } = await supabase
    .from('orders')
    .select('client_secret')
    .eq('id', currentOrderId)
    .single();
  
  if (!data) return;
  
  // Ссылка на сайт с якорем на отслеживание
  const siteUrl = window.location.href.replace('admin.html', 'index.html#my-orders');
  const shareLink = `${siteUrl}?secret=${data.client_secret}`;
  
  await navigator.clipboard.writeText(shareLink);
  alert('✅ Ссылка скопирована! Отправьте её клиенту.');
});

// === Инициализация ===
document.addEventListener('DOMContentLoaded', () => {
  // Авто-вход если уже авторизован (можно доработать через localStorage)
});