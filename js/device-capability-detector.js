// Device Capability Detector
// Comprehensive device capability detection using modern APIs
window.DeviceCapabilityDetector = (() => {
  let capabilities = null;

  function detectCapabilities() {
    const caps = {
      deviceMemory: null,
      hardwareConcurrency: navigator.hardwareConcurrency || 4,
      connection: null,
      screen: {
        width: screen.width,
        height: screen.height,
        devicePixelRatio: window.devicePixelRatio || 1,
      },
      webgl: {
        maxTextureSize: 2048,
        available: false,
      },
      tier: 'medium', // Default to medium
    };

    // Detect device memory (Chrome/Edge only)
    if (navigator.deviceMemory) {
      caps.deviceMemory = navigator.deviceMemory;
    } else {
      // Fallback: Estimate based on hardware concurrency
      // Rough estimate: 2GB per core (conservative)
      caps.deviceMemory = Math.max(2, caps.hardwareConcurrency * 2);
    }

    // Detect network connection
    if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      caps.connection = {
        effectiveType: conn.effectiveType || '4g',
        downlink: conn.downlink || 10,
        rtt: conn.rtt || 50,
        saveData: conn.saveData || false,
      };
    } else {
      // Default to 4g if API not available
      caps.connection = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
      };
    }

    // Detect WebGL capabilities
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        caps.webgl.available = true;
        caps.webgl.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
      }
    } catch (e) {
      console.warn('[DeviceCapability] WebGL detection failed:', e);
    }

    // Calculate device tier
    caps.tier = calculateDeviceTier(caps);

    return caps;
  }

  function calculateDeviceTier(caps) {
    const memory = caps.deviceMemory || 4;
    const cores = caps.hardwareConcurrency || 4;
    const connection = caps.connection?.effectiveType || '4g';
    const isSlowConnection = connection === 'slow-2g' || connection === '2g';

    // Low tier: <4GB RAM OR <4 cores OR slow connection
    if (memory < 4 || cores < 4 || isSlowConnection) {
      return 'low';
    }

    // Medium tier: 4GB RAM AND 4 cores AND 3g/4g connection
    if (memory >= 4 && memory < 8 && cores >= 4 && cores < 6 && !isSlowConnection) {
      return 'medium';
    }

    // High tier: 8GB+ RAM AND 6+ cores AND 4g connection
    if (memory >= 8 && cores >= 6 && connection === '4g') {
      // Check for high-end GPU (large texture size indicates better GPU)
      if (caps.webgl.maxTextureSize >= 4096) {
        return 'ultra';
      }
      return 'high';
    }

    // Ultra tier: 8GB+ RAM AND 8+ cores AND 4g connection AND high-end GPU
    if (memory >= 8 && cores >= 8 && connection === '4g' && caps.webgl.maxTextureSize >= 8192) {
      return 'ultra';
    }

    // Default to medium if criteria don't match exactly
    return 'medium';
  }

  return {
    init() {
      capabilities = detectCapabilities();
      console.log('[DeviceCapability] Detected capabilities:', capabilities);
      return capabilities;
    },

    getCapabilities() {
      if (!capabilities) {
        capabilities = detectCapabilities();
      }
      return capabilities;
    },

    getTier() {
      const caps = this.getCapabilities();
      return caps.tier;
    },

    getDeviceMemory() {
      const caps = this.getCapabilities();
      return caps.deviceMemory;
    },

    getConnectionType() {
      const caps = this.getCapabilities();
      return caps.connection?.effectiveType || '4g';
    },

    isLowEnd() {
      return this.getTier() === 'low';
    },

    isHighEnd() {
      const tier = this.getTier();
      return tier === 'high' || tier === 'ultra';
    },
  };
})();

