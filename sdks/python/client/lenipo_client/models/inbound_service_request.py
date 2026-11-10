from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.inbound_service_request_custom_fields import InboundServiceRequestCustomFields





T = TypeVar("T", bound="InboundServiceRequest")



@_attrs_define
class InboundServiceRequest:
    """ 
        Attributes:
            email (str): The person asking; answers reach them at this address.
            summary (str): Short title of the request.
            name (str | Unset): Their name in Lenipo; without it the part of the address before the @.
            request_type (str | Unset): Id or name of a request type of the desk; without it the first one.
            description (str | Unset): Plain text or Markdown.
            priority (str | Unset): Priority key such as high; only if the request type asks for it.
            due_date (datetime.date | Unset): Due date, only if the request type asks for it.
            custom_fields (InboundServiceRequestCustomFields | Unset): Values by custom field id, as far as the request type
                asks for them.
     """

    email: str
    summary: str
    name: str | Unset = UNSET
    request_type: str | Unset = UNSET
    description: str | Unset = UNSET
    priority: str | Unset = UNSET
    due_date: datetime.date | Unset = UNSET
    custom_fields: InboundServiceRequestCustomFields | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.inbound_service_request_custom_fields import InboundServiceRequestCustomFields # noqa: PLC0415
        email = self.email

        summary = self.summary

        name = self.name

        request_type = self.request_type

        description = self.description

        priority = self.priority

        due_date: str | Unset = UNSET
        if not isinstance(self.due_date, Unset):
            due_date = self.due_date.isoformat()

        custom_fields: dict[str, Any] | Unset = UNSET
        if not isinstance(self.custom_fields, Unset):
            custom_fields = self.custom_fields.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "email": email,
            "summary": summary,
        })
        if name is not UNSET:
            field_dict["name"] = name
        if request_type is not UNSET:
            field_dict["requestType"] = request_type
        if description is not UNSET:
            field_dict["description"] = description
        if priority is not UNSET:
            field_dict["priority"] = priority
        if due_date is not UNSET:
            field_dict["dueDate"] = due_date
        if custom_fields is not UNSET:
            field_dict["customFields"] = custom_fields

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.inbound_service_request_custom_fields import InboundServiceRequestCustomFields # noqa: PLC0415
        d = dict(src_dict)
        email = d.pop("email")

        summary = d.pop("summary")

        name = d.pop("name", UNSET)

        request_type = d.pop("requestType", UNSET)

        description = d.pop("description", UNSET)

        priority = d.pop("priority", UNSET)

        _due_date = d.pop("dueDate", UNSET)
        due_date: datetime.date | Unset
        if isinstance(_due_date,  Unset):
            due_date = UNSET
        else:
            due_date = datetime.date.fromisoformat(_due_date)




        _custom_fields = d.pop("customFields", UNSET)
        custom_fields: InboundServiceRequestCustomFields | Unset
        if isinstance(_custom_fields,  Unset):
            custom_fields = UNSET
        else:
            custom_fields = InboundServiceRequestCustomFields.from_dict(_custom_fields)




        inbound_service_request = cls(
            email=email,
            summary=summary,
            name=name,
            request_type=request_type,
            description=description,
            priority=priority,
            due_date=due_date,
            custom_fields=custom_fields,
        )


        inbound_service_request.additional_properties = d
        return inbound_service_request

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
