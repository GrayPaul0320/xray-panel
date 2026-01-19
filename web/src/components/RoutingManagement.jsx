import React, { useState, useEffect } from 'react';
import { 
  getRoutingRules, 
  createRoutingRule, 
  updateRoutingRule, 
  deleteRoutingRule 
} from '../services/api';
import { X } from 'lucide-react';

const RoutingManagement = ({ slaveId }) => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  // 表单状态
  const [formData, setFormData] = useState({
    type: 'field',
    outboundTag: '',
    domain: [],
    ip: [],
    port: '',
    network: '',
    source: [],
    user: [],
    inboundTag: [],
    protocol: [],
    attrs: '',
  });

  useEffect(() => {
    fetchRules();
  }, [slaveId]);

  const fetchRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRoutingRules(slaveId);
      setRules(data.rules || []);
    } catch (err) {
      setError(err.message || '获取路由规则列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const ruleConfig = {
        type: formData.type,
        outboundTag: formData.outboundTag,
      };

      // 添加非空字段
      if (formData.domain.length > 0) {
        ruleConfig.domain = formData.domain;
      }
      if (formData.ip.length > 0) {
        ruleConfig.ip = formData.ip;
      }
      if (formData.port) {
        ruleConfig.port = formData.port;
      }
      if (formData.network) {
        ruleConfig.network = formData.network;
      }
      if (formData.source.length > 0) {
        ruleConfig.source = formData.source;
      }
      if (formData.user.length > 0) {
        ruleConfig.user = formData.user;
      }
      if (formData.inboundTag.length > 0) {
        ruleConfig.inboundTag = formData.inboundTag;
      }
      if (formData.protocol.length > 0) {
        ruleConfig.protocol = formData.protocol;
      }
      if (formData.attrs) {
        ruleConfig.attrs = formData.attrs;
      }

      await createRoutingRule(slaveId, ruleConfig);

      setError({ type: 'success', message: '路由规则已添加，请推送配置到 Slave' });
      setTimeout(() => {
        setShowForm(false);
        resetForm();
        fetchRules();
        setError(null);
      }, 1500);
    } catch (err) {
      setError({ type: 'error', message: err.message || '创建路由规则失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRule = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const ruleConfig = {
        type: formData.type,
        outboundTag: formData.outboundTag,
      };

      if (formData.domain.length > 0) ruleConfig.domain = formData.domain;
      if (formData.ip.length > 0) ruleConfig.ip = formData.ip;
      if (formData.port) ruleConfig.port = formData.port;
      if (formData.network) ruleConfig.network = formData.network;
      if (formData.source.length > 0) ruleConfig.source = formData.source;
      if (formData.user.length > 0) ruleConfig.user = formData.user;
      if (formData.inboundTag.length > 0) ruleConfig.inboundTag = formData.inboundTag;
      if (formData.protocol.length > 0) ruleConfig.protocol = formData.protocol;
      if (formData.attrs) ruleConfig.attrs = formData.attrs;

      await updateRoutingRule(slaveId, editingRule.id, ruleConfig);

      setError({ type: 'success', message: '路由规则已更新，请推送配置到 Slave' });
      setTimeout(() => {
        setShowForm(false);
        setEditingRule(null);
        resetForm();
        fetchRules();
        setError(null);
      }, 1500);
    } catch (err) {
      setError({ type: 'error', message: err.message || '更新路由规则失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (rule) => {
    if (!window.confirm(`确定要删除路由规则 "${rule.outbound_tag}" 吗？`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await deleteRoutingRule(slaveId, rule.id);

      setError({ type: 'success', message: '路由规则已删除，请推送配置到 Slave' });
      setTimeout(() => {
        fetchRules();
        setError(null);
      }, 1500);
    } catch (err) {
      setError({ type: 'error', message: err.message || '删除路由规则失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditRule = (rule) => {
    setEditingRule(rule);
    const config = rule.config || {};
    setFormData({
      type: config.type || 'field',
      outboundTag: config.outboundTag || '',
      domain: config.domain || [],
      ip: config.ip || [],
      port: config.port || '',
      network: config.network || '',
      source: config.source || [],
      user: config.user || [],
      inboundTag: config.inboundTag || [],
      protocol: config.protocol || [],
      attrs: config.attrs || '',
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      type: 'field',
      outboundTag: '',
      domain: [],
      ip: [],
      port: '',
      network: '',
      source: [],
      user: [],
      inboundTag: [],
      protocol: [],
      attrs: '',
    });
    setEditingRule(null);
  };

  const handleArrayInput = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setFormData({ ...formData, [field]: array });
  };

  return (
    <div className="routing-management">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-white">路由规则管理</h3>
        <button
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          disabled={loading}
        >
          + 添加路由规则
        </button>
      </div>

      {error && (
        <div className={`${error.type === 'success' ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'} border p-4 rounded-lg mb-4`}>
          <strong>{error.type === 'success' ? '成功:' : '错误:'}</strong> {error.message || error}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xl font-bold text-white">{editingRule ? '编辑' : '添加'} 路由规则</h4>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={editingRule ? handleUpdateRule : handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">类型 *</label>
                <select
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded text-white focus:border-primary-500 focus:outline-none"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                >
                  <option value="field">Field (字段匹配)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Outbound Tag (目标出站) *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded text-white focus:border-primary-500 focus:outline-none"
                  value={formData.outboundTag}
                  onChange={(e) => setFormData({ ...formData, outboundTag: e.target.value })}
                  placeholder="例如: proxy-out"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">域名匹配 (Domain)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded text-white focus:border-primary-500 focus:outline-none"
                  value={formData.domain.join(', ')}
                  onChange={(e) => handleArrayInput('domain', e.target.value)}
                  placeholder="例如: google.com, geosite:cn (用逗号分隔)"
                />
                <small className="text-gray-500 text-xs mt-1 block">
                  支持: domain:example.com, full:www.example.com, geosite:cn
                </small>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">IP 匹配 (IP)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded text-white focus:border-primary-500 focus:outline-none"
                  value={formData.ip.join(', ')}
                  onChange={(e) => handleArrayInput('ip', e.target.value)}
                  placeholder="例如: 192.168.1.0/24, geoip:cn (用逗号分隔)"
                />
                <small className="text-gray-500 text-xs mt-1 block">
                  支持: IP/CIDR, geoip:cn
                </small>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">端口匹配 (Port)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded text-white focus:border-primary-500 focus:outline-none"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                  placeholder="例如: 80, 443, 80-443"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">网络类型 (Network)</label>
                <select
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded text-white focus:border-primary-500 focus:outline-none"
                  value={formData.network}
                  onChange={(e) => setFormData({ ...formData, network: e.target.value })}
                >
                  <option value="">不限制</option>
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="tcp,udp">TCP + UDP</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">来源 IP (Source)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded text-white focus:border-primary-500 focus:outline-none"
                  value={formData.source.join(', ')}
                  onChange={(e) => handleArrayInput('source', e.target.value)}
                  placeholder="例如: 10.0.0.0/8 (用逗号分隔)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Inbound Tag</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded text-white focus:border-primary-500 focus:outline-none"
                  value={formData.inboundTag.join(', ')}
                  onChange={(e) => handleArrayInput('inboundTag', e.target.value)}
                  placeholder="例如: socks-in (用逗号分隔)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">协议 (Protocol)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded text-white focus:border-primary-500 focus:outline-none"
                  value={formData.protocol.join(', ')}
                  onChange={(e) => handleArrayInput('protocol', e.target.value)}
                  placeholder="例如: http, tls (用逗号分隔)"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
                  disabled={loading}
                >
                  {loading ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && !showForm && <div className="text-center py-8 text-gray-400">加载中...</div>}

      {!loading && rules.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-2">暂无路由规则</p>
          <p className="text-gray-500 text-sm">点击上方按钮添加新的路由规则</p>
        </div>
      )}

      {!loading && rules.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-dark-700 border-b border-gray-700">
                <th className="text-left p-3 text-gray-300 font-semibold">Outbound Tag</th>
                <th className="text-left p-3 text-gray-300 font-semibold">匹配条件</th>
                <th className="text-left p-3 text-gray-300 font-semibold">状态</th>
                <th className="text-left p-3 text-gray-300 font-semibold">最后更新</th>
                <th className="text-left p-3 text-gray-300 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-gray-700 hover:bg-dark-700/50">
                  <td className="p-3">
                    <strong className="text-white">{rule.outbound_tag}</strong>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {rule.config.domain && (
                        <span className="px-2 py-1 rounded text-xs bg-blue-900/30 text-blue-300 border border-blue-500/30">
                          域名: {rule.config.domain.join(', ')}
                        </span>
                      )}
                      {rule.config.ip && (
                        <span className="px-2 py-1 rounded text-xs bg-yellow-900/30 text-yellow-300 border border-yellow-500/30">
                          IP: {rule.config.ip.join(', ')}
                        </span>
                      )}
                      {rule.config.port && (
                        <span className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-300">
                          端口: {rule.config.port}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${rule.status === 'active' ? 'bg-green-900/30 text-green-300 border border-green-500/30' : 'bg-gray-700 text-gray-400'}`}>
                      {rule.status === 'active' ? '激活' : '未激活'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-400">{rule.last_updated}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        onClick={() => handleEditRule(rule)}
                        disabled={loading}
                      >
                        编辑
                      </button>
                      <button
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        onClick={() => handleDeleteRule(rule)}
                        disabled={loading}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RoutingManagement;
