import { supabase } from './supabase.js';

// === Навигация ===
window.showSection = (id) => {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  
  document.querySelectorAll('.nav__links a').forEach(a => a.classList.remove('active'));
  const link = document.querySelector(`.nav__links a[onclick*="${id}"]`);
  if (link) link.classList.add('active');
  
  if (id === 'portfolio') loadPortfolio();
};

// === Загрузка портфолио ===
async function loadPortfolio() {
  const { data, error } = await supabase
    .from('portfolio')
    .select('*')
    .eq('is_active', true);
  if (error) return console.error('Portfolio error:', error);
  
  const grid = document.getElementById('portfolioGrid');
  if (!grid) return;
  
  grid.innerHTML = data.map(item => `
    <div class="card" onclick="openProject(${item.id})">
      <div class="card__preview">${item.preview_image || '🎨'}</div>
      <h4>${item.title}</h4>
      <p style="color:var(--text-muted);margin:8px 0">${item.description?.slice(0,80)}${item.description?.length>80?'...':''}</p>
      ${item.price ? `<span class="card__price">${item.price}</span>` : ''}
    </div>
  `).join('');
}

// === Модальное окно проекта ===
window.openProject = async (id) => {
  const { data, error } = await supabase
    .from('portfolio')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return;
  
  document.getElementById('modalTitle').textContent = data.title;
  document.getElementById('modalDesc').textContent = data.description;
  document.getElementById('modalPrice').textContent = data.price || '';
  document.getElementById('modalPreview').innerHTML = data.preview_image 
    ? `<img src="${data.preview_image}" style="width:100%;border-radius:12px">` 
    : '';
  document.getElementById('projectModal').classList.add('active');
};

// Закрытие модальных окон
document.querySelectorAll('.modal__close').forEach(btn => {
  btn.onclick = () => btn.closest('.modal').classList.remove('active');
});
window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.classList.remove('active'); };

// === Отправка заказа ===
document.getElementById('orderForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const statusEl = document.getElementById('orderStatus');
  const btn = form.querySelector('button[type="submit"]');
  
  const formData = new FormData(form);
  const secret = Math.random().toString(36).substring(2, 10).toUpperCase(); // Простой код доступа
  
  const order = {
    client_name: formData.get('name'),
    client_email: formData.get('email'),
    service_type: formData.get('type'),
    description: formData.get('description'),
    status: 'new',
    client_secret: secret
  };
  
  btn.disabled = true;
  btn.textContent = 'Отправка...';
  
  try {
    const { data, error } = await supabase
      .from('orders')
      .insert([order])
      .select()
      .single();
    if (error) throw error;
    
    // Показываем успешный результат
    form.style.display = 'none';
    document.getElementById('orderSuccess').style.display = 'block';
    document.getElementById('newOrderId').textContent = data.id;
    document.getElementById('secretCode').textContent = secret;
    
  } catch (err) {
    console.error('Order error:', err);
    statusEl.textContent = `❌ Ошибка: ${err.message}`;
    statusEl.style.color = 'var(--danger)';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Отправить заявку';
  }
});

// === Отслеживание заказа ===
window.trackOrder = async () => {
  const secret = document.getElementById('trackSecret').value.trim().toUpperCase();
  const details = document.getElementById('orderDetails');
  
  if (!secret) {
    alert('Введите код заказа');
    return;
  }
  
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('client_secret', secret)
    .single();
  
  if (error || !data) {
    alert('❌ Заказ не найден. Проверьте код.');
    return;
  }
  
  // Заполняем данные
  document.getElementById('trackId').textContent = data.id;
  document.getElementById('trackDesc').textContent = data.description;
  
  const statusEl = document.getElementById('trackStatus');
  statusEl.textContent = {
    'new': '🆕 Новый',
    'in_progress': '🔄 В работе',
    'completed': '✅ Готов'
  }[data.status] || data.status;
  statusEl.className = `status-badge status-${data.status}`;
  
  // Если готово — показываем ссылку
  const resultBlock = document.getElementById('resultBlock');
  if (data.status === 'completed' && data.result_file_url) {
    document.getElementById('downloadLink').href = data.result_file_url;
    resultBlock.style.display = 'block';
  } else {
    resultBlock.style.display = 'none';
  }
  
  details.style.display = 'block';
};

// === Инициализация ===
document.addEventListener('DOMContentLoaded', () => {
  loadPortfolio();
});