// Classe principal da aplicação
class iCAPTracker {
    constructor() {
        this.isTracking = false;
        this.isPaused = false;
        this.currentOrderId = null;
        this.trackingInterval = null;
        this.qrCodeScanner = null;
        this.locationHistory = [];
        this.settings = {
            updateInterval: 30000, // 30 segundos
            serverUrl: 'http://192.168.0.40:8080' // Usar IP da rede em vez de localhost
        };
        
        this.init();
    }
    
    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.updateConnectionStatus();
        this.checkGeolocationSupport();
        
        // Verificar se há rastreamento ativo salvo
        this.restoreActiveTracking();
    }
    
    // Configuração de eventos
    setupEventListeners() {
        // Scanner QR Code
        document.getElementById('startScanBtn').addEventListener('click', () => this.startQRScanner());
        document.getElementById('stopScanBtn').addEventListener('click', () => this.stopQRScanner());
        
        // Input manual
        document.getElementById('manualStartBtn').addEventListener('click', () => this.startManualTracking());
        document.getElementById('manualOrderId').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.startManualTracking();
        });
        
        // Controles de rastreamento
        document.getElementById('pauseTrackingBtn').addEventListener('click', () => this.pauseTracking());
        document.getElementById('finishDeliveryBtn').addEventListener('click', () => this.finishDelivery());
        document.getElementById('stopTrackingBtn').addEventListener('click', () => this.stopTracking());
        
        // Configurações
        document.getElementById('updateInterval').addEventListener('change', (e) => {
            this.settings.updateInterval = parseInt(e.target.value) * 1000;
            this.saveSettings();
            if (this.isTracking) {
                this.restartTracking();
            }
        });
        
        document.getElementById('serverUrl').addEventListener('change', (e) => {
            this.settings.serverUrl = e.target.value;
            this.saveSettings();
            this.updateConnectionStatus();
        });
        
        document.getElementById('testConnectionBtn').addEventListener('click', () => this.testConnection());
        
        // Eventos de visibilidade da página
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isTracking) {
                this.showToast('App em segundo plano - rastreamento continua', 'warning');
            }
        });
        
        // Eventos de rede
        window.addEventListener('online', () => {
            this.updateConnectionStatus();
            this.showToast('Conexão restaurada', 'success');
        });
        
        window.addEventListener('offline', () => {
            this.updateConnectionStatus();
            this.showToast('Sem conexão - dados serão sincronizados quando voltar online', 'warning');
        });
    }
    
    // Scanner QR Code
    async startQRScanner() {
        try {
            if (!this.qrCodeScanner) {
                this.qrCodeScanner = new Html5Qrcode("qr-reader");
            }
            
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };
            
            await this.qrCodeScanner.start(
                { facingMode: "environment" },
                config,
                (decodedText) => this.onQRCodeScanned(decodedText),
                (errorMessage) => {
                    // Ignorar erros de scan contínuo
                    if (!errorMessage.includes('No QR code found')) {
                        console.log('QR Scanner error:', errorMessage);
                    }
                }
            );
            
            document.getElementById('startScanBtn').style.display = 'none';
            document.getElementById('stopScanBtn').style.display = 'inline-flex';
            
            this.showToast('Scanner ativado - posicione sobre o QR Code', 'success');
            
        } catch (error) {
            console.error('Erro ao iniciar scanner:', error);
            this.showToast('Erro ao acessar câmera. Verifique as permissões.', 'error');
        }
    }
    
    async stopQRScanner() {
        try {
            if (this.qrCodeScanner) {
                await this.qrCodeScanner.stop();
                this.qrCodeScanner.clear();
            }
            
            document.getElementById('startScanBtn').style.display = 'inline-flex';
            document.getElementById('stopScanBtn').style.display = 'none';
            
            this.showToast('Scanner desativado', 'success');
            
        } catch (error) {
            console.error('Erro ao parar scanner:', error);
        }
    }
    
    onQRCodeScanned(decodedText) {
        console.log('QR Code escaneado:', decodedText);
        this.stopQRScanner();
        this.startTracking(decodedText);
    }
    
    // Rastreamento manual
    startManualTracking() {
        const orderId = document.getElementById('manualOrderId').value.trim();
        if (!orderId) {
            this.showToast('Digite o código do pedido', 'error');
            return;
        }
        
        this.startTracking(orderId);
    }
    
    // Iniciar rastreamento
    async startTracking(orderId) {
        try {
            // Validar pedido no servidor
            const isValid = await this.validateOrder(orderId);
            if (!isValid) {
                this.showToast('Pedido não encontrado ou inválido', 'error');
                return;
            }
            
            this.currentOrderId = orderId;
            this.isTracking = true;
            this.isPaused = false;
            this.locationHistory = [];
            
            // Atualizar status do pedido para "Em Transporte"
            await this.updateOrderStatus(orderId, 'Em Transporte');
            
            // Salvar estado
            this.saveTrackingState();
            
            // Atualizar UI
            this.showTrackingSection();
            this.updateTrackingInfo();
            
            // Iniciar rastreamento GPS
            this.startLocationTracking();
            
            this.showToast(`Rastreamento iniciado para pedido ${orderId}`, 'success');
            
        } catch (error) {
            console.error('Erro ao iniciar rastreamento:', error);
            this.showToast('Erro ao iniciar rastreamento', 'error');
        }
    }
    
    // Rastreamento de localização
    startLocationTracking() {
        if (!navigator.geolocation) {
            this.showToast('Geolocalização não suportada neste dispositivo', 'error');
            return;
        }
        
        // Primeira localização imediata
        this.getCurrentLocation();
        
        // Configurar intervalo
        this.trackingInterval = setInterval(() => {
            if (!this.isPaused) {
                this.getCurrentLocation();
            }
        }, this.settings.updateInterval);
        
        this.showToast('Rastreamento GPS ativo', 'success');
    }
    
    getCurrentLocation() {
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
        };
        
        navigator.geolocation.getCurrentPosition(
            (position) => this.onLocationSuccess(position),
            (error) => this.onLocationError(error),
            options
        );
    }
    
    async onLocationSuccess(position) {
        const locationData = {
            orderId: this.currentOrderId,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed,
            timestamp: new Date().toISOString()
        };
        
        // Adicionar ao histórico local
        this.locationHistory.unshift(locationData);
        if (this.locationHistory.length > 50) {
            this.locationHistory = this.locationHistory.slice(0, 50);
        }
        
        // Enviar para servidor
        try {
            await this.sendLocationToServer(locationData);
            this.updateConnectionStatus(true);
        } catch (error) {
            console.error('Erro ao enviar localização:', error);
            this.updateConnectionStatus(false);
            // Salvar para sincronização posterior
            this.saveLocationForSync(locationData);
        }
        
        // Atualizar UI
        this.updateLocationDisplay(locationData);
        this.updateLocationHistory();
    }
    
    onLocationError(error) {
        let message = 'Erro ao obter localização';
        
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'Permissão de localização negada';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Localização indisponível';
                break;
            case error.TIMEOUT:
                message = 'Timeout ao obter localização';
                break;
        }
        
        console.error('Erro de geolocalização:', error);
        this.showToast(message, 'error');
    }
    
    // Comunicação com servidor
    async validateOrder(orderId) {
        try {
            const response = await fetch(`${this.settings.serverUrl}/api/orders/validate/${orderId}`);
            if (!response.ok) {
                return false;
            }
            
            const data = await response.json();
            console.log('Resposta da validação:', data);
            
            // Verificar se o pedido é válido na resposta
            return data.valid === true;
        } catch (error) {
            console.error('Erro ao validar pedido:', error);
            return false;
        }
    }
    
    async updateOrderStatus(orderId, status) {
        try {
            const response = await fetch(`${this.settings.serverUrl}/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });
            
            if (!response.ok) {
                throw new Error('Falha ao atualizar status');
            }
            
            return true;
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            return false;
        }
    }
    
    async sendLocationToServer(locationData) {
        const response = await fetch(`${this.settings.serverUrl}/api/tracking/location`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(locationData)
        });
        
        if (!response.ok) {
            throw new Error('Falha ao enviar localização');
        }
        
        return response.json();
    }
    
    async testConnection() {
        try {
            const response = await fetch(`${this.settings.serverUrl}/api/health`);
            if (response.ok) {
                this.showToast('Conexão OK', 'success');
                this.updateConnectionStatus(true);
            } else {
                throw new Error('Servidor não respondeu');
            }
        } catch (error) {
            this.showToast('Falha na conexão', 'error');
            this.updateConnectionStatus(false);
        }
    }
    
    // Controles de rastreamento
    pauseTracking() {
        this.isPaused = !this.isPaused;
        const btn = document.getElementById('pauseTrackingBtn');
        
        if (this.isPaused) {
            btn.innerHTML = '▶️ Retomar Rastreamento';
            btn.className = 'btn btn-success';
            this.showToast('Rastreamento pausado', 'warning');
        } else {
            btn.innerHTML = '⏸️ Pausar Rastreamento';
            btn.className = 'btn btn-warning';
            this.showToast('Rastreamento retomado', 'success');
        }
        
        this.saveTrackingState();
    }
    
    async finishDelivery() {
        if (!confirm('Confirmar finalização da entrega?')) {
            return;
        }
        
        try {
            // Atualizar status para "Entregue"
            await this.updateOrderStatus(this.currentOrderId, 'Entregue');
            
            this.showToast('Entrega finalizada com sucesso!', 'success');
            this.stopTracking();
            
        } catch (error) {
            this.showToast('Erro ao finalizar entrega', 'error');
        }
    }
    
    stopTracking() {
        if (!confirm('Parar rastreamento? Esta ação não pode ser desfeita.')) {
            return;
        }
        
        this.isTracking = false;
        this.isPaused = false;
        this.currentOrderId = null;
        
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }
        
        // Limpar estado salvo
        this.clearTrackingState();
        
        // Voltar para tela inicial
        this.showScannerSection();
        
        this.showToast('Rastreamento interrompido', 'success');
    }
    
    restartTracking() {
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
        }
        this.startLocationTracking();
    }
    
    // Gerenciamento de UI
    showScannerSection() {
        document.getElementById('scannerSection').style.display = 'block';
        document.getElementById('trackingSection').style.display = 'none';
        document.getElementById('manualOrderId').value = '';
    }
    
    showTrackingSection() {
        document.getElementById('scannerSection').style.display = 'none';
        document.getElementById('trackingSection').style.display = 'block';
    }
    
    updateTrackingInfo() {
        document.getElementById('currentOrderId').textContent = this.currentOrderId || '-';
        document.getElementById('currentStatus').textContent = this.isTracking ? 'Em Transporte' : 'Parado';
        document.getElementById('lastUpdate').textContent = new Date().toLocaleString('pt-BR');
    }
    
    updateLocationDisplay(locationData) {
        const coords = `${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`;
        document.getElementById('currentLocation').textContent = coords;
        document.getElementById('locationAccuracy').textContent = `±${Math.round(locationData.accuracy)}m`;
        document.getElementById('lastUpdate').textContent = new Date(locationData.timestamp).toLocaleString('pt-BR');
    }
    
    updateLocationHistory() {
        const container = document.getElementById('locationHistory');
        
        if (this.locationHistory.length === 0) {
            container.innerHTML = '<p class="no-data">Nenhum ponto registrado ainda</p>';
            return;
        }
        
        const html = this.locationHistory.map(location => `
            <div class="location-item">
                <div>
                    <div class="location-coords">${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</div>
                    <div class="location-time">${new Date(location.timestamp).toLocaleString('pt-BR')}</div>
                </div>
                <div class="location-accuracy">±${Math.round(location.accuracy)}m</div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }
    
    updateConnectionStatus(isOnline = navigator.onLine) {
        const indicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const dot = indicator.querySelector('.status-dot');
        
        if (isOnline) {
            dot.className = 'status-dot online';
            statusText.textContent = 'Online';
        } else {
            dot.className = 'status-dot offline';
            statusText.textContent = 'Offline';
        }
    }
    
    // Notificações
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Remover após 5 segundos
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }
    
    // Persistência de dados
    saveSettings() {
        localStorage.setItem('icap_tracker_settings', JSON.stringify(this.settings));
    }
    
    loadSettings() {
        const saved = localStorage.getItem('icap_tracker_settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
        
        // Aplicar configurações na UI
        document.getElementById('updateInterval').value = this.settings.updateInterval / 1000;
        document.getElementById('serverUrl').value = this.settings.serverUrl;
    }
    
    saveTrackingState() {
        const state = {
            isTracking: this.isTracking,
            isPaused: this.isPaused,
            currentOrderId: this.currentOrderId,
            locationHistory: this.locationHistory
        };
        localStorage.setItem('icap_tracker_state', JSON.stringify(state));
    }
    
    restoreActiveTracking() {
        const saved = localStorage.getItem('icap_tracker_state');
        if (saved) {
            const state = JSON.parse(saved);
            if (state.isTracking && state.currentOrderId) {
                this.currentOrderId = state.currentOrderId;
                this.isTracking = state.isTracking;
                this.isPaused = state.isPaused;
                this.locationHistory = state.locationHistory || [];
                
                this.showTrackingSection();
                this.updateTrackingInfo();
                this.updateLocationHistory();
                
                if (!this.isPaused) {
                    this.startLocationTracking();
                }
                
                this.showToast('Rastreamento restaurado', 'success');
            }
        }
    }
    
    clearTrackingState() {
        localStorage.removeItem('icap_tracker_state');
    }
    
    saveLocationForSync(locationData) {
        const pending = JSON.parse(localStorage.getItem('icap_tracker_pending') || '[]');
        pending.push(locationData);
        localStorage.setItem('icap_tracker_pending', JSON.stringify(pending));
    }
    
    // Verificações de suporte
    checkGeolocationSupport() {
        if (!navigator.geolocation) {
            this.showToast('Geolocalização não suportada neste dispositivo', 'error');
            return false;
        }
        return true;
    }
}

// Inicializar aplicação quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.tracker = new iCAPTracker();
});

// Exportar para uso global
window.iCAPTracker = iCAPTracker; 