from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.feature_flags import FeatureFlags
  from ..models.instance_notice_announcement_type_0 import InstanceNoticeAnnouncementType0
  from ..models.maintenance_mode import MaintenanceMode





T = TypeVar("T", bound="InstanceNotice")



@_attrs_define
class InstanceNotice:
    """ 
        Attributes:
            modules (FeatureFlags):
            maintenance (MaintenanceMode):
            announcement (InstanceNoticeAnnouncementType0 | None):
            help_url (None | str):
     """

    modules: FeatureFlags
    maintenance: MaintenanceMode
    announcement: InstanceNoticeAnnouncementType0 | None
    help_url: None | str





    def to_dict(self) -> dict[str, Any]:
        from ..models.feature_flags import FeatureFlags # noqa: PLC0415
        from ..models.instance_notice_announcement_type_0 import InstanceNoticeAnnouncementType0 # noqa: PLC0415
        from ..models.maintenance_mode import MaintenanceMode # noqa: PLC0415
        modules = self.modules.to_dict()

        maintenance = self.maintenance.to_dict()

        announcement: dict[str, Any] | None
        if isinstance(self.announcement, InstanceNoticeAnnouncementType0):
            announcement = self.announcement.to_dict()
        else:
            announcement = self.announcement

        help_url: None | str
        help_url = self.help_url


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "modules": modules,
            "maintenance": maintenance,
            "announcement": announcement,
            "helpUrl": help_url,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.feature_flags import FeatureFlags # noqa: PLC0415
        from ..models.instance_notice_announcement_type_0 import InstanceNoticeAnnouncementType0 # noqa: PLC0415
        from ..models.maintenance_mode import MaintenanceMode # noqa: PLC0415
        d = dict(src_dict)
        modules = FeatureFlags.from_dict(d.pop("modules"))




        maintenance = MaintenanceMode.from_dict(d.pop("maintenance"))




        def _parse_announcement(data: object) -> InstanceNoticeAnnouncementType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                announcement_type_0 = InstanceNoticeAnnouncementType0.from_dict(data)



                return announcement_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(InstanceNoticeAnnouncementType0 | None, data)

        announcement = _parse_announcement(d.pop("announcement"))


        def _parse_help_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        help_url = _parse_help_url(d.pop("helpUrl"))


        instance_notice = cls(
            modules=modules,
            maintenance=maintenance,
            announcement=announcement,
            help_url=help_url,
        )

        return instance_notice

