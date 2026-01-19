import React, { useState, useEffect } from 'react';
import { 
  getOutbounds, 
  createOutbound, 
  updateOutbound, 
  deleteOutbound 
} from '../services/api';
import { X } from 'lucide-react';

const OutboundManagement = ({ slaveId }) => {
  const [outbounds, setOutbounds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingOutbound, setEditingOutbound] = useState(null);

  // 表单状态
  const [formData, setFormData] = useState({
    tag: '',
    protocol: 'freedom',
    settings: {},
    streamSettings: null,
    proxySettings: null,
    mux: null,
  });

  // 常用协议配置模板
  const protocolTemplates = {
    freedom: {
      domainStrategy: 'AsIs',
    },
    vmess: {
      vnext: [{
        address: '',
        port: 443,
        users: [{
          id: '',
          security: 'auto',
        }],
      }],
    },
    vless: {
      vnext: [{
        address: '',
        port: 443,
        users: [{
          id: '',
          encryption: 'none',
        }],
      }],
    },
    trojan: {
      servers: [{
        address: '',
        port: 443,
        password: '',
      }],
    },
    shadowsocks: {
      servers: [{
        address: '',
        port: 8388,
        method: 'aes-256-gcm',
        password: '',
      }],
    },
  };

  useEffect(() => {
    fetchOutbounds();
  }, [slaveId]);

  const fetchOutbounds = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getOutbounds(slaveId);
      setOutbounds(response.data?.outbounds || []);
    } catch (err) {
      setError(err.message || '获取 Outbound 列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleProtocolChange = (protocol) => {
    setFormData({
      ...formData,
      protocol,
      settings: protocolTemplates[protocol] || {},
    });
  };

  const handleCreateOutbound = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const outboundConfig = {
        tag: formData.tag,
        protocol: formData.protocol,
        settings: formData.settings,
      };

      // 添加可选字段
      if (formData.streamSettings) {
        outboundConfig.streamSettings = formData.streamSettings;
      }
      if (formData.proxySettings) {
        outboundConfig.proxySettings = formData.proxySettings;
      }
      if (formData.mux) {
        outboundConfig.mux = formData.mux;
      }

      await createOutbound(slaveId, outboundConfig);

      setError({ type: 'success', message: 'Outbound 已添加，请推送配置到 Slave' });
      setTimeout(() => {
        setShowForm(false);
        resetForm();
        fetchOutbounds();
      }, 1500);
    } catch (err) {
      setError({ type: 'error', message: err.message || '创建 Outbound 失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOutbound = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const outboundConfig = {
        tag: formData.tag,
        protocol: formData.protocol,
        settings: formData.settings,
      };

      if (formData.streamSettings) {
        outboundConfig.streamSettings = formData.streamSettings;
      }
      if (formData.proxySettings) {
        outboundConfig.proxySettings = formData.proxySettings;
      }
      if (formData.mux) {
        outboundConfig.mux = formData.mux;
      }

      await updateOutbound(slaveId, editingOutbound.id, outboundConfig);

      setError({ type: 'success', message: 'Outbound 已更新，请推送配置到 Slave' });
      setTimeout(() => {
        setShowForm(false);
        setEditingOutbound(null);
        resetForm();
        fetchOutbounds();
      }, 1500);
    } catch (err) {
      setError({ type: 'error', message: err.message || '更新 Outbound 失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOutbound = async (outbound) => {
    if (!window.confirm(`确定要删除 Outbound "${outbound.tag}" 吗？`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await deleteOutbound(slaveId, outbound.id);

      setError({ type: 'success', message: 'Outbound 已删除，请推送配置到 Slave' });
      setTimeout(() => {
        fetchOutbounds();
      }, 1500);
    } catch (err) {
      setError({ type: 'error', message: err.message || '删除 Outbound 失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditOutbound = (outbound) => {
    setEditingOutbound(outbound);
    setFormData({
      tag: outbound.tag,
      protocol: outbound.protocol,
      settings: outbound.config.settings || {},
      streamSettings: outbound.config.streamSettings || null,
      proxySettings: outbound.config.proxySettings || null,
      mux: outbound.config.mux || null,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      tag: '',
      protocol: 'freedom',
      settings: protocolTemplates.freedom,
      streamSettings: null,
      proxySettings: null,
      mux: null,
    });
    setEditingOutbound(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Outbound 管理</h3>
        <button
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          disabled={loading}
        >
          + 添加 Outbound
        </button>
      </div>

      {error && (
        <div className={`p-4 rounded-lg ${
          error.type === 'success' ? 'bg-green-900/20 border border-green-500/30' : 'bg-red-900/20 border border-red-500/30'
        }`}>
          <strong className={error.type === 'success' ? 'text-green-400' : 'text-red-400'}>
            {error.type === 'success' ? '成功:' : '错误:'}
          </strong>
          <span className="ml-2 text-gray-300">{error.message || error}</span>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xl font-semibold text-white">
                {editingOutbound ? '编辑' : '添加'} Outbound
              </h4>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={editingOutbound ? handleUpdateOutbound : handleCreateOutbound} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tag (标识符) *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded text-white focus:border-primary-500 focus:outline-none"
                  value={formData.tag}
                  onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                  placeholder="例如: proxy-out"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  协议 *
                </label>
                <select
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded text-white focus:border-primary-500 focus:outline-none"
                  value={formData.protocol}
                  onChange={(e) => handleProtocolChange(e.target.value)}
                  required
                >
                  <option value="freedom">Freedom (直连)</option>
                  <option value="vmess">VMess</option>
                  <option value="vless">VLESS</option>
                  <option value="trojan">Trojan</option>
                  <option value="shadowsocks">Shadowsocks</option>
                  <option value="blackhole">Blackhole (阻止)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  配置 (JSON) *
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded text-white font-mono text-sm focus:border-primary-500 focus:outline-none"
                  rows="10"
                  value={JSON.stringify(formData.settings, null, 2)}
                  onChange={(e) => {
                    try {
                      const settings = JSON.parse(e.target.value);
                      setFormData({ ...formData, settings });
                    } catch (err) {
                      // 暂时不更新，等待用户输入完整的 JSON
                    }
                  }}
                  placeholder='例如: {"domainStrategy": "AsIs"}'
                  required
                />
                <small className="text-gray-500 text-xs mt-1 block">
                  请输入有效的 JSON 格式配置
                </small>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
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

      {loading && !showForm && (
        <div className="text-center py-8 text-gray-400">加载中...</div>
      )}

      {!loading && outbounds.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-300 text-lg">暂无 Outbound 配置</p>
          <p className="text-gray-500 text-sm mt-2">点击上方按钮添加新的 Outbound</p>
        </div>
      )}

      {!loading && outbounds.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-300 font-medium">Tag</th>
                <th className="text-left py-3 px-4 text-gray-300 font-medium">协议</th>
                <th className="text-left py-3 px-4 text-gray-300 font-medium">状态</th>
                <th className="text-left py-3 px-4 text-gray-300 font-medium">最后更新</th>
                <th className="text-left py-3 px-4 text-gray-300 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {outbounds.map((outbound) => (
                <tr key={outbound.id} className="border-b border-gray-700/50 hover:bg-dark-700/50">
                  <td className="py-3 px-4">
                    <strong className="text-white">{outbound.tag}</strong>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs">
                      {outbound.protocol}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      outbound.status === 'active'
                        ? 'bg-green-600/20 text-green-400'
                        : 'bg-gray-600/20 text-gray-400'
                    }`}>
                      {outbound.status === 'active' ? '激活' : '未激活'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-sm">{outbound.last_updated}</td>
                  <td className="py-3 px-4">
                    <div className="flex space-x-2">
                      <button
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        onClick={() => handleEditOutbound(outbound)}
                        disabled={loading}
                      >
                        编辑
                      </button>
                      <button
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        onClick={() => handleDeleteOutbound(outbound)}
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

export default OutboundManagement;
