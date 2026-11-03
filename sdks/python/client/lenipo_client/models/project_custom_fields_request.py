from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.project_custom_fields_request_settings import ProjectCustomFieldsRequestSettings





T = TypeVar("T", bound="ProjectCustomFieldsRequest")



@_attrs_define
class ProjectCustomFieldsRequest:
    """ 
        Attributes:
            field_ids (list[UUID]):
            settings (ProjectCustomFieldsRequestSettings | Unset):
     """

    field_ids: list[UUID]
    settings: ProjectCustomFieldsRequestSettings | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.project_custom_fields_request_settings import ProjectCustomFieldsRequestSettings # noqa: PLC0415
        field_ids = []
        for field_ids_item_data in self.field_ids:
            field_ids_item = str(field_ids_item_data)
            field_ids.append(field_ids_item)



        settings: dict[str, Any] | Unset = UNSET
        if not isinstance(self.settings, Unset):
            settings = self.settings.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "fieldIds": field_ids,
        })
        if settings is not UNSET:
            field_dict["settings"] = settings

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.project_custom_fields_request_settings import ProjectCustomFieldsRequestSettings # noqa: PLC0415
        d = dict(src_dict)
        field_ids = []
        _field_ids = d.pop("fieldIds")
        for field_ids_item_data in (_field_ids):
            field_ids_item = UUID(field_ids_item_data)



            field_ids.append(field_ids_item)


        _settings = d.pop("settings", UNSET)
        settings: ProjectCustomFieldsRequestSettings | Unset
        if isinstance(_settings,  Unset):
            settings = UNSET
        else:
            settings = ProjectCustomFieldsRequestSettings.from_dict(_settings)




        project_custom_fields_request = cls(
            field_ids=field_ids,
            settings=settings,
        )


        project_custom_fields_request.additional_properties = d
        return project_custom_fields_request

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
