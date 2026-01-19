import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getBalancers, createBalancer, updateBalancer, deleteBalancer } from '../services/api';

const BalancerManagement = ({ slaveId }) => {
  const [balancers, setBalancers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBalancer, setEditingBalancer] = useState(null);

  // 表单状态
  const [formData, setFormData] = useState({
    tag: '',
    selector: [],
    strategy: 'random',
  });

  useEffect(() => {
    fetchBalancers();
  }, [slaveId]);

  const fetchBalancers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBalancers(slaveId);
      setBalancers(data.balancers || []);
    } catch (err) {
      setError({ type: 'error', message: err.message || '获取负载均衡器列表失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBalancer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const balancerConfig = {
        tag: formData.tag,
        selector: formData.selector,
      };

      // 添加策略（如果不是默认值）
      if (formData.strategy && formData.strategy !== 'random') {
        balancerConfig.strategy = formData.strategy;
      }

      await createBalancer(slaveId, balancerConfig);

      setError({ type: 'success', message: '负载均衡器已添加，请推送配置到 Slave' });
      setTimeout(() => {
        setShowForm(false);
        resetForm();
        fetchBalancers();
        setError(null);
      }, 1500);
    } catch (err) {
      setError({ type: 'error', message: err.message || '创建负载均衡器失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBalancer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const balancerConfig = {
        tag: formData.tag,
        selector: formData.selector,
      };

      if (formData.strategy && formData.strategy !== 'random') {
        balancerConfig.strategy = formData.strategy;
      }

      await updateBalancer(slaveId, editingBalancer.id, balancerConfig);

      setError({ type: 'success', message: '负载均衡器已更新，请推送配置到 Slave' });
      setTimeout(() => {
        setShowForm(false);
        setEditingBalancer(null);
        resetForm();
        fetchBalancers();
        setError(null);
      }, 1500);
    } catch (err) {
      setError({ type: 'error', message: err.message || '更新负载均衡器失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBalancer = async (balancer) => {
    if (!window.confirm(`确定要删除负载均衡器 "${balancer.tag}" 吗？`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await deleteBalancer(slaveId, balancer.id);

      setError({ type: 'success', message: '负载均衡器已删除，请推送配置到 Slave' });
      setTimeout(() => {
        fetchBalancers();
        setError(null);
      }, 1500);
    } catch (err) {
      setError({ type: 'error', message: err.message || '删除负载均衡器失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditBalancer = (balancer) => {
    setEditingBalancer(balancer);
    setFormData({
      tag: balancer.tag,
      selector: balancer.selector || [],
      strategy: balancer.strategy || 'random',
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      tag: '',
      selector: [],
      strategy: 'random',
    });
    setEditingBalancer(null);
  };

  const handleArrayInput = (value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    setFormData({ ...formData, selector: array });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">负载均衡器管理</h3>
        <button
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          disabled={loading}
        >
          + 添加负载均衡器
        </button>
      </div>

      {error && (
        <div className={error.type === 'success' ? 'bg-green-900/20 border border-green-500/30 p-4 rounded-lg' : 'bg-red-900/20 border border-red-500/30 p-4 rounded-lg'}>
          <strong className={error.type === 'success' ? 'text-green-400' : 'text-red-400'}>
            {error.type === 'success' ? '成功:' : '错误:'}
          </strong> {error.message}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xl font-semibold text-white">{editingBalancer ? '编辑' : '添加'} 负载均衡器</h4>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={editingBalancer ? handleUpdateBalancer : handleCreateBalancer}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Tag (标识符) *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded text-white focus:border-primary-500 focus:outline-none"
                  value={formData.tag}
                  onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                  placeholder="例如: proxy-balancer"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Selector (Outbound 选择器) *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded text-white focus:border-primary-500 focus:outline-none"
                  value={formData.selector.join(', ')}
                  onChange={(e) => handleArrayInput(e.target.value)}
                  placeholder="例如: proxy-, us-proxy (用逗号分隔，支持前缀匹配)"
                  required
                />
                <span className="text-gray-500 text-xs mt-1 block">
                  输入 Outbound tag 或前缀（如 "proxy-" 会匹配所有以 "proxy-" 开头的 Outbound）
                </span>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">负载均衡策略 *</label>
                <select
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded text-white focus:border-primary-500 focus:outline-none"
                  value={formData.strategy}
                  onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
                  required
                >
                  <option value="random">Random (随机)</option>
                  <option value="leastPing">Least Ping (最低延迟)</option>
                  <option value="leastLoad">Least Load (最低负载)</option>
                </select>
                <span className="text-gray-500 text-xs mt-1 block">
                  Random: 随机选择 | Least Ping: 选择延迟最低的 | Least Load: 选择负载最低的
                </span>
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
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" disabled={loading}>
                  {loading ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && !showForm && <div className="text-center py-8 text-gray-400">加载中...</div>}

      {!loading && balancers.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-300 text-lg">暂无负载均衡器配置</p>
          <p className="text-gray-500 text-sm mt-2">点击上方按钮添加新的负载均衡器</p>
        </div>
      )}

      {!loading && balancers.length > 0 && (
        <div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-300 font-medium">Tag</th>
                <th className="text-left py-3 px-4 text-gray-300 font-medium">Selector</th>
                <th className="text-left py-3 px-4 text-gray-300 font-medium">策略</th>
                <th className="text-left py-3 px-4 text-gray-300 font-medium">状态</th>
                <th className="text-left py-3 px-4 text-gray-300 font-medium">最后更新</th>
                <th className="text-left py-3 px-4 text-gray-300 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {balancers.map((balancer) => (
                <tr key={balancer.id} className="border-b border-gray-700/50 hover:bg-dark-700/50">
                  <td className="py-3 px-4">
                    <strong className="text-white">{balancer.tag}</strong>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-2">
                      {balancer.selector && balancer.selector.map((sel, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-600/30 text-gray-300 rounded text-xs">
                          {sel}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs">
                      {balancer.strategy || 'random'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      balancer.status === 'active' 
                        ? 'bg-green-600/20 text-green-400' 
                        : 'bg-gray-600/20 text-gray-400'
                    }`}>
                      {balancer.status === 'active' ? '激活' : '未激活'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-sm">{balancer.last_updated}</td>
                  <td className="py-3 px-4">
                    <button
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mr-2"
                      onClick={() => handleEditBalancer(balancer)}
                      disabled={loading}
                    >
                      编辑
                    </button>
                    <button
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleDeleteBalancer(balancer)}
                      disabled={loading}
                    >
                      删除
                    </button>
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

export default BalancerManagement;
