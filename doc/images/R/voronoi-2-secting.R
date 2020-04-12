library(ggplot2)
library(ggvoronoi)

shape <- data.frame(
  x = c(0, 1, 1, 2, 2, 3, 3, 0, 0),
  y = c(0, 0, 3, 3, 0, 0, 4, 4, 0),
  plot = 'Shape'
)
medialAxisCentral <- data.frame(
  x = c(
    0.5, 0.5,
    1+cos(seq(-pi, -3/2*pi, length.out = 625))/2,
    1, 2,
    2+cos(seq(-3/2*pi, -2*pi, length.out = 625))/2,
    2.5, 2.5
  ),
  y = c(
    0.5, 3,
    3+sin(seq(-pi, -3/2*pi, length.out = 625))/2,
    3.5, 3.5,
    3+sin(seq(-3/2*pi, -2*pi, length.out = 625))/2,
    3, 0.5
  ),
  plot = 'Medial\nAxis'
)
medialAxisWings1 <- data.frame(
  x = c(0, 0.5, 1),
  y = c(0, 0.5, 0),
  plot = 'Medial\nAxis'
)
medialAxisWings2 <- data.frame(
  x = c(2, 2.5, 3),
  y = c(0, 0.5, 0),
  plot = 'Medial\nAxis'
)
medialAxisWings3 <- data.frame(
  x = c(0, 1-(2^0.5/2)/2),
  y = c(4, 3+(2^0.5/2)/2),
  plot = 'Medial\nAxis'
)
medialAxisWings4 <- data.frame(
  x = c(2+(2^0.5/2)/2, 3),
  y = c(3+(2^0.5/2)/2, 4),
  plot = 'Medial\nAxis'
)

sites <- data.frame(
  x = c(0, 0, 0, 1.5, 3, 3, 3, 2.5, 2, 2, 2, 1.5, 1, 1, 1, 0.5),
  y = c(0, 2, 4, 4, 4, 2, 0, 0, 0, 1.5, 3, 3, 3, 1.5, 0, 0),
  plot = 'Voronoi'
)

ggplot() +
  stat_voronoi(data = sites, aes(x, y), linetype = 'solid', geom = "path", col = 'red') +
  geom_path(data = shape, aes(x, y), linetype = 'solid', col = 'black') +
  geom_path(
    data = medialAxisCentral,
    aes(x, y), linetype = 'dashed', col = 'black'
  ) +
  geom_path(
    data = medialAxisWings1,
    aes(x, y), linetype = 'dashed', col = 'black'
  ) +
  geom_path(
    data = medialAxisWings2,
    aes(x, y), linetype = 'dashed', col = 'black'
  ) +
  geom_path(
    data = medialAxisWings3,
    aes(x, y), linetype = 'dashed', col = 'black'
  ) +
  geom_path(
    data = medialAxisWings4,
    aes(x, y), linetype = 'dashed', col = 'black'
  ) +
  coord_fixed() +
  # scale_linetype_manual(values = c("Shape" = "solid", "Medial\nAxis" = "dashed", "Voronoi" = "solid")) +
  guides(
    linetype = guide_legend(title = '')
  ) +
  theme_grey() +
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
  labs(title = 'Voronoi 2-secting Edges')

ggsave(filename = '../voronoi-2-secting.png', height = 6, width = 6, dpi = 100)
