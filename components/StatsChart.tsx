import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Task, TaskStatus } from '../types';

interface StatsChartProps {
  tasks: Task[];
}

const StatsChart: React.FC<StatsChartProps> = ({ tasks }) => {
  const data = [
    {
      name: 'Cần làm',
      count: tasks.filter(t => t.status === TaskStatus.TODO).length,
      color: '#94a3b8' // Slate 400
    },
    {
      name: 'Đang làm',
      count: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      color: '#3b82f6' // Blue 500
    },
    {
      name: 'Hoàn thành',
      count: tasks.filter(t => t.status === TaskStatus.DONE).length,
      color: '#22c55e' // Green 500
    },
  ];

  return (
    <div className="h-64 w-full bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
      <h3 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">Tổng quan tiến độ</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748b', fontSize: 12 }} 
            dy={10}
          />
          <YAxis hide />
          <Tooltip 
            cursor={{ fill: 'transparent' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="count" radius={[6, 6, 6, 6]} barSize={40}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatsChart;