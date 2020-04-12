library(ggplot2)

shape <- data.frame(
  x = c(0, 5, 5, 0),
  y = c(0, 0, 1, 0)
)
mic <- data.frame(
  x = 3.75+cos(seq(0, 2*pi, length.out = 2500))/4,
  y = 0.25+sin(seq(0, 2*pi, length.out = 2500))/4
)
micCenter <- data.frame(x = 3.75, y = 0.25)
ggplot() +
  geom_path(data = shape, aes(x, y), colour = 'black') +
  geom_path(data = mic, aes(x, y), colour = 'blue') +
  geom_point(data = micCenter, aes(x, y), colour = 'blue') +
  coord_fixed() +
  theme(
    axis.title = element_blank(),
    axis.ticks = element_blank(),
    axis.text = element_blank(),
    plot.background = element_rect(fill = '#DCDCDC'),
    legend.background = element_rect(fill = '#DCDCDC'),
    plot.margin = margin(0.1, 0.1, 0.1, 0.1, "cm"),
    panel.background = element_rect(fill = "#D3D3D3"),
    plot.title = element_text(hjust = 0.5)
  ) +
  labs(title = 'numSegments: 2 (Runtime: 1ms)')

ggsave(filename = '../triangle-2-secting.png', height = 2, width = 6, dpi = 100)
