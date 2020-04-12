library(ggplot2)

shape <- data.frame(
  x = c(0, 2.5, 5, 3, 3, 2, 2, 0),
  y = c(0, 4, 0, 4, 5, 5, 4, 0)
)
mic <- data.frame(
  x = 2.5+cos(seq(0, 2*pi, length.out = 2500))/2,
  y = 4.5+sin(seq(0, 2*pi, length.out = 2500))/2
)
micCenter <- data.frame(x = 2.5, y = 4.5)
centroid <- data.frame(x = 2.5, y = 3.277778)
ggplot(shape, aes(x, y)) +
  geom_path() +
  geom_path(data = mic, aes(x, y, colour = 'Maximum\nInscribed\nCircle')) +
  geom_point(data = micCenter, aes(x, y), colour = 'blue') +
  geom_point(data = centroid, aes(x, y, shape = "Centroid"), colour = 'red') +
  coord_fixed() +
  scale_colour_manual(values = c('Maximum\nInscribed\nCircle' = 'blue')) +
  scale_shape_manual(values = c("Centroid" = 16)) +
  guides(
    shape = guide_legend(title = ''),
    colour = guide_legend(title = '')
  ) +
  theme(
    axis.title = element_blank(),
    axis.ticks = element_blank(),
    axis.text = element_blank(),
    plot.background = element_rect(fill = '#DCDCDC'),
    legend.background = element_rect(fill = '#DCDCDC'),
    plot.margin = margin(0.1, 0.1, 0.1, 0.1, "cm"),
    panel.background = element_rect(fill = "#D3D3D3")
  )

ggsave(filename = '../motivation.png', height = 6, width = 6, dpi = 100)
